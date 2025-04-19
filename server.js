// Simple WebSocket signaling server for Remote Pointer
const WebSocket = require("ws");
const http = require("http");
const url = require("url");

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Remote Pointer Signaling Server");
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active sessions
const sessions = new Map();

// Handle new WebSocket connections
wss.on("connection", (ws, req) => {
  // Parse URL parameters
  const queryParams = url.parse(req.url, true).query;
  const sessionCode = queryParams.code;
  const role = queryParams.role; // 'host' or 'client'

  if (!sessionCode || !role || (role !== "host" && role !== "client")) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Invalid connection parameters",
      })
    );
    ws.close();
    return;
  }

  console.log(`New connection: ${role} for session ${sessionCode}`);

  // Register the connection
  if (!sessions.has(sessionCode)) {
    sessions.set(sessionCode, { host: null, clients: [] });
  }

  const session = sessions.get(sessionCode);

  if (role === "host") {
    // Set up host connection
    if (session.host) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Host already exists for this session",
        })
      );
      ws.close();
      return;
    }

    session.host = { ws, id: Date.now() };

    // Notify host about existing clients
    if (session.clients.length > 0) {
      ws.send(
        JSON.stringify({
          type: "info",
          message: `${session.clients.length} client(s) waiting for connection`,
        })
      );

      // Notify clients that host is now available
      session.clients.forEach((client) => {
        client.ws.send(
          JSON.stringify({
            type: "host-ready",
            sessionCode,
          })
        );
      });
    }
  } else {
    // Set up client connection
    const clientId = Date.now();
    session.clients.push({ ws, id: clientId });

    // Notify client if host is available
    if (session.host) {
      ws.send(
        JSON.stringify({
          type: "host-ready",
          sessionCode,
        })
      );

      // Notify host of new client
      session.host.ws.send(
        JSON.stringify({
          type: "join",
          clientId,
          sessionCode,
        })
      );
    }
  }

  // Handle WebSocket messages
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const session = sessions.get(sessionCode);

      if (!session) return;

      // Handle signaling messages
      if (data.type === "signal") {
        if (role === "host" && session.clients.length > 0) {
          // Broadcast signal to all clients
          session.clients.forEach((client) => {
            client.ws.send(
              JSON.stringify({
                type: "signal",
                role: "host",
                signal: data.signal,
                sessionCode,
              })
            );
          });
        } else if (role === "client" && session.host) {
          // Send client signal to host
          session.host.ws.send(
            JSON.stringify({
              type: "signal",
              role: "client",
              signal: data.signal,
              clientId: data.clientId || Date.now(),
              sessionCode,
            })
          );
        }
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  // Handle WebSocket disconnections
  ws.on("close", () => {
    if (!sessions.has(sessionCode)) return;

    const session = sessions.get(sessionCode);

    if (role === "host" && session.host && session.host.ws === ws) {
      console.log(`Host disconnected from session ${sessionCode}`);

      // Notify clients
      session.clients.forEach((client) => {
        client.ws.send(
          JSON.stringify({
            type: "host-disconnected",
            sessionCode,
          })
        );
      });

      session.host = null;

      // If no clients left, remove the session
      if (session.clients.length === 0) {
        sessions.delete(sessionCode);
        console.log(`Session ${sessionCode} removed`);
      }
    } else if (role === "client") {
      // Find and remove the client
      const clientIndex = session.clients.findIndex(
        (client) => client.ws === ws
      );

      if (clientIndex !== -1) {
        const clientId = session.clients[clientIndex].id;
        session.clients.splice(clientIndex, 1);
        console.log(`Client disconnected from session ${sessionCode}`);

        // Notify host if available
        if (session.host) {
          session.host.ws.send(
            JSON.stringify({
              type: "client-disconnected",
              clientId,
              sessionCode,
            })
          );
        }

        // If no host and no clients left, remove the session
        if (!session.host && session.clients.length === 0) {
          sessions.delete(sessionCode);
          console.log(`Session ${sessionCode} removed`);
        }
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});

// Clean up inactive sessions periodically
setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, code) => {
    // Check if session is empty
    if ((!session.host || !session.host.ws) && session.clients.length === 0) {
      sessions.delete(code);
      console.log(`Removed inactive session ${code}`);
    }
  });
}, 60000); // Check every minute

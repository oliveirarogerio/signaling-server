require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store active sessions
const sessions = new Map();

// Helper function to clean up a session
function cleanupSession(sessionId) {
  if (sessions.has(sessionId)) {
    console.log(`Cleaning up session ${sessionId}`);
    sessions.delete(sessionId);
  }
}

// API routes
app.get("/", (req, res) => {
  res.send("Pong Signaling Server is running");
});

// Get server status
app.get("/status", (req, res) => {
  res.json({
    status: "ok",
    activeSessions: sessions.size,
    uptime: process.uptime(),
  });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Host creates a new session
  socket.on("createSession", (callback) => {
    const sessionId = uuidv4().substring(0, 6).toUpperCase();

    sessions.set(sessionId, {
      hostId: socket.id,
      clientId: null,
      offer: null,
      iceCandidates: {
        host: [],
        client: [],
      },
    });

    socket.join(sessionId);
    console.log(`Host created session: ${sessionId}`);

    // Set a timeout to clean up unused sessions
    setTimeout(() => {
      const session = sessions.get(sessionId);
      if (session && !session.clientId) {
        console.log(`Session ${sessionId} timed out without client joining`);
        cleanupSession(sessionId);
      }
    }, 10 * 60 * 1000); // 10 minutes

    // Return the session ID to the host
    callback({ sessionId });
  });

  // Client joins an existing session
  socket.on("joinSession", (data, callback) => {
    const { sessionId } = data;

    if (!sessions.has(sessionId)) {
      return callback({ error: "Session not found" });
    }

    const session = sessions.get(sessionId);

    if (session.clientId) {
      return callback({ error: "Session is full" });
    }

    // Update session with client info
    session.clientId = socket.id;
    socket.join(sessionId);
    console.log(`Client joined session: ${sessionId}`);

    // Notify host that client has joined
    io.to(session.hostId).emit("clientJoined");

    // Return success to client
    callback({ success: true });

    // Send stored offer if available
    if (session.offer) {
      socket.emit("offer", session.offer);
    }

    // Send any stored ICE candidates from host
    session.iceCandidates.host.forEach((candidate) => {
      socket.emit("iceCandidate", {
        from: "host",
        candidate,
      });
    });
  });

  // Exchange SDP offers and answers
  socket.on("offer", (data) => {
    const { sessionId, offer } = data;

    if (!sessions.has(sessionId)) return;

    const session = sessions.get(sessionId);
    session.offer = offer;

    // Forward offer to client if connected
    if (session.clientId) {
      io.to(session.clientId).emit("offer", offer);
    }
  });

  socket.on("answer", (data) => {
    const { sessionId, answer } = data;

    if (!sessions.has(sessionId)) return;

    const session = sessions.get(sessionId);

    // Forward answer to host
    io.to(session.hostId).emit("answer", answer);
  });

  // Exchange ICE candidates
  socket.on("iceCandidate", (data) => {
    const { sessionId, candidate, isHost } = data;

    if (!sessions.has(sessionId)) return;

    const session = sessions.get(sessionId);
    const role = isHost ? "host" : "client";

    // Store candidate
    session.iceCandidates[role].push(candidate);

    // Forward to the other peer
    if (isHost && session.clientId) {
      io.to(session.clientId).emit("iceCandidate", {
        from: "host",
        candidate,
      });
    } else if (!isHost && session.hostId) {
      io.to(session.hostId).emit("iceCandidate", {
        from: "client",
        candidate,
      });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Find and clean up any sessions associated with this socket
    sessions.forEach((session, sessionId) => {
      if (session.hostId === socket.id) {
        // Host disconnected, notify client
        if (session.clientId) {
          io.to(session.clientId).emit("hostDisconnected");
        }
        cleanupSession(sessionId);
      } else if (session.clientId === socket.id) {
        // Client disconnected, notify host
        io.to(session.hostId).emit("clientDisconnected");
        session.clientId = null;
      }
    });
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});

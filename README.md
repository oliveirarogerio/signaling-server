# Pong Signaling Server

A WebRTC signaling server for the multiplayer Pong game application. This server facilitates the WebRTC connection establishment between peers by handling session creation, SDP offer/answer exchange, and ICE candidate distribution.

## Features

- Creates and manages game sessions
- Handles WebRTC signaling (SDP exchange and ICE candidates)
- Provides session status and connection events
- Automatically cleans up inactive sessions

## Prerequisites

- Node.js 16 or higher
- npm or yarn

## Local Development

1. Clone the repository
2. Navigate to the signaling-server directory
3. Install dependencies:
   ```
   npm install
   ```
4. Create a `.env` file based on the example above
5. Start the development server:
   ```
   npm run dev
   ```

The server will be running at http://localhost:3000 by default.

## API Endpoints

- `GET /` - Check if the server is running
- `GET /status` - Get server status information

## WebSocket Events

### Client -> Server

- `createSession` - Creates a new game session (host)
- `joinSession` - Joins an existing session (client)
- `offer` - Sends SDP offer
- `answer` - Sends SDP answer
- `iceCandidate` - Sends ICE candidates

### Server -> Client

- `clientJoined` - Notifies host when a client joins
- `hostDisconnected` - Notifies client when host disconnects
- `clientDisconnected` - Notifies host when client disconnects
- `offer` - Forwards SDP offer
- `answer` - Forwards SDP answer
- `iceCandidate` - Forwards ICE candidates

## Deployment to Railway

1. Create a Railway account at https://railway.app
2. Install the Railway CLI:
   ```
   npm i -g @railway/cli
   ```
3. Login to Railway:
   ```
   railway login
   ```
4. Initialize the project:
   ```
   railway init
   ```
5. Deploy the server:
   ```
   railway up
   ```
6. Set environment variables:
   ```
   railway variables set PORT=3000 NODE_ENV=production
   ```

## Environment Variables

- `PORT` - Port to run the server on (default: 3000)
- `NODE_ENV` - Node environment (development/production)

## License

MIT

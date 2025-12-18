# OpenTunnel Architecture

## System Overview

OpenTunnel is a self-hosted HTTPS tunneling system that allows developers to expose local services to the internet through a central server.

## Components

### 1. Server (Node.js/Express)
- **Purpose**: Central tunnel server that receives HTTPS traffic and forwards it to connected clients
- **Key Features**:
  - Express HTTP server for handling incoming HTTPS requests
  - WebSocket endpoint (`/connect`) for tunnel establishment
  - Single active tunnel at a time (simple design)
  - Reverse proxy functionality: forwards incoming requests to tunnel client
  - Works behind Render's managed HTTPS (TLS termination happens before Node.js)
  - Graceful handling when tunnel disconnects

### 2. Client (Node.js CLI)
- **Purpose**: Connects to server and forwards local traffic
- **Key Features**:
  - Global npm package (`opentunnel`)
  - CLI commands: `init`, `status`, and default tunnel command
  - Persistent configuration storage
  - Auto-reconnect with exponential backoff
  - Colored logging
  - Streaming support for large payloads

## Communication Protocol

### WebSocket Message Types

1. **Tunnel Registration** (Client → Server)
   ```json
   {
     "type": "register",
     "port": 3000
   }
   ```

2. **Request Forwarding** (Server → Client)
   ```json
   {
     "type": "request",
     "id": "unique-request-id",
     "method": "GET",
     "url": "/path",
     "headers": {},
     "body": "chunked-data" // or null for streaming
   }
   ```

3. **Response** (Client → Server)
   ```json
   {
     "type": "response",
     "id": "unique-request-id",
     "status": 200,
     "headers": {},
     "body": "chunked-data" // or null for streaming
   }
   ```

4. **Stream Chunk** (Bidirectional)
   ```json
   {
     "type": "chunk",
     "id": "unique-request-id",
     "data": "base64-encoded-chunk"
   }
   ```

5. **Stream End** (Bidirectional)
   ```json
   {
     "type": "end",
     "id": "unique-request-id"
   }
   ```

## Data Flow

1. **Tunnel Establishment**:
   - Client connects via WebSocket to `/connect`
   - Client sends registration message
   - Server stores active tunnel connection

2. **Request Processing**:
   - External HTTPS request arrives at server
   - Server forwards request metadata to client via WebSocket
   - If body exists, stream it in chunks
   - Client receives request, forwards to local service
   - Client streams response back to server
   - Server responds to original HTTPS request

3. **Disconnection Handling**:
   - Server detects WebSocket disconnect
   - Returns 503 Service Unavailable for incoming requests
   - Client detects disconnect, initiates reconnection with backoff

## File Structure

```
opentunnel/
├─ server/
│  ├─ server.js          # Express server + WebSocket handler
│  ├─ tunnel.js          # Tunnel connection management
│  └─ package.json       # Server dependencies
│
├─ client/
│  ├─ bin/
│  │  └─ opentunnel.js   # CLI entry point
│  ├─ lib/
│  │  ├─ tunnel.js        # WebSocket tunnel client
│  │  ├─ reconnect.js     # Auto-reconnect logic
│  │  ├─ status.js        # Status tracking
│  │  └─ config.js        # Config persistence
│  └─ package.json        # Client dependencies + bin
│
├─ docker/
│  └─ Dockerfile          # Client Docker image
│
├─ homebrew/
│  └─ opentunnel.rb       # Homebrew formula
│
└─ README.md              # Complete documentation
```

## Technology Choices

- **Node.js**: Modern ESM modules
- **Express**: HTTP server framework
- **ws**: WebSocket library
- **chalk**: Terminal colors
- **minimist**: CLI argument parsing
- **fs/promises**: Config file persistence

## Render Deployment Considerations

- Render terminates TLS before Node.js
- Server runs on HTTP (not HTTPS)
- Render provides HTTPS automatically
- No need for certificate management
- Free tier constraints: single instance, no persistent storage needed

## Security Considerations

- No authentication by default (self-hosted, private use)
- Optional shared secret can be added later
- WebSocket connections are over HTTPS (via Render)
- Local services remain on localhost (not exposed directly)

## Error Handling

- Server: Returns 503 when tunnel disconnected
- Client: Auto-reconnect with exponential backoff
- Both: Clear error messages with colored logging
- Streaming: Handles partial failures gracefully


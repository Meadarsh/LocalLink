/**
 * LocalLink Server
 * Express server with WebSocket tunnel endpoint
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { TunnelManager } from './tunnel.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Create tunnel manager
const tunnelManager = new TunnelManager();

// Don't parse request bodies - we'll stream them directly
// This allows us to handle large payloads without buffering
app.use((req, res, next) => {
  // Skip body parsing for streaming
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const status = tunnelManager.getStatus();
  res.json({
    status: 'ok',
    tunnel: status
  });
});

// WebSocket server for tunnel connections
const server = app.listen(PORT, () => {
  console.log(`LocalLink server listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/connect`);
});

const wss = new WebSocketServer({ 
  server,
  path: '/connect'
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection from:', req.socket.remoteAddress);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'register') {
        const tunnel = tunnelManager.registerTunnel(ws, message);
        console.log(`Tunnel registered on port ${tunnel.port}`);
        
        // Send confirmation
        ws.send(JSON.stringify({
          type: 'registered',
          port: tunnel.port
        }));
      } else if (message.type === 'response' || message.type === 'chunk' || message.type === 'end') {
        // These are handled by the tunnel manager's pending requests
        // The tunnel manager has its own message listeners set up
        // No need to emit - the listeners are already registered
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Forward all other requests to the tunnel (except health and static assets)
app.use((req, res, next) => {
  // Skip health endpoint
  if (req.path === '/health') {
    return next();
  }
  
  try {
    tunnelManager.forwardRequest(req, res);
  } catch (error) {
    console.error('Error in forwardRequest:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});


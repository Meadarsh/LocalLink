/**
 * Tunnel client - WebSocket connection to server
 */

import WebSocket from 'ws';
import http from 'http';
import { updateStatus, clearStatus } from './status.js';
import { ReconnectManager } from './reconnect.js';
import { logger } from './logger.js';

// Track pending requests for streaming
const pendingRequests = new Map(); // requestId -> { req, chunks }

// Track connection state
let connectionState = {
  connected: false,
  connectedAt: null,
  port: null,
  domain: null
};

// Reconnect manager instance
let reconnectManager = null;

export async function createTunnel(serverUrl, localPort) {
  // Create reconnect manager
  reconnectManager = new ReconnectManager({
    onReconnectAttempt: (attempt, delay) => {
      // Clear screen and show reconnecting message
      process.stdout.write('\x1b[2J\x1b[0f'); // Clear screen
      logger.warn(`Reconnecting... (attempt ${attempt}, waiting ${Math.floor(delay / 1000)}s)`);
    },
    onReconnect: () => {
      logger.success('Reconnected successfully');
    }
  });

  // Start initial connection
  await connectOnce(serverUrl, localPort);
  
  // Keep process alive and handle reconnections
  process.on('SIGINT', () => {
    if (reconnectManager) {
      reconnectManager.cancel();
    }
    process.exit(0);
  });
}

async function connectOnce(serverUrl, localPort) {
  // Convert HTTPS URL to WSS URL
  const wsUrl = serverUrl.replace(/^https?:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  const connectUrl = `${wsUrl}/connect`;

  return new Promise((resolve, reject) => {
    logger.info(`Connecting to ${connectUrl}...`);
    logger.info(`Tunneling localhost:${localPort} -> ${serverUrl}`);

    const ws = new WebSocket(connectUrl);

    ws.on('open', () => {
      logger.success('Connected to server');
      
      // Reset reconnect attempts on successful connection
      if (reconnectManager) {
        reconnectManager.reset();
      }
      
      // Update connection state
      connectionState.connected = true;
      connectionState.connectedAt = new Date().toISOString();
      connectionState.port = localPort;
      connectionState.domain = serverUrl;
      
      // Update status file
      updateStatus({
        connected: true,
        connectedAt: connectionState.connectedAt,
        port: localPort,
        domain: serverUrl
      });
      
      // Register tunnel
      ws.send(JSON.stringify({
        type: 'register',
        port: localPort
      }));
      
      resolve(ws);
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'registered') {
          logger.success(`✓ Tunnel registered on port ${message.port}`);
          logger.success(`✓ Your service is now available at ${serverUrl}`);
        } else if (message.type === 'request') {
          // Forward request to local service
          await forwardToLocal(message, localPort, ws);
        } else if (message.type === 'chunk' && message.direction === 'request') {
          // Stream request body chunk
          handleRequestChunk(message, ws);
        } else if (message.type === 'end' && message.direction === 'request') {
          // End of request body stream
          handleRequestEnd(message, ws);
        } else if (message.type === 'error') {
          logger.error('Server error:', message.message);
        }
      } catch (error) {
        logger.error('Error handling message:', error);
      }
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error.message);
      // Don't reject here, let close handler trigger reconnection
    });

    ws.on('close', () => {
      logger.warn('Connection closed');
      
      // Update connection state
      connectionState.connected = false;
      connectionState.connectedAt = null;
      
      // Clear status file
      clearStatus();
      
      // Clean up pending requests
      pendingRequests.clear();
      
      // Trigger reconnection
      if (reconnectManager) {
        reconnectManager.reconnect(() => {
          return connectOnce(serverUrl, localPort);
        }).catch((error) => {
          console.error('Reconnection failed:', error.message);
          process.exit(1);
        });
      }
    });
  });
}

async function forwardToLocal(message, localPort, ws) {
  const { id, method, url, headers, body, hasBody } = message;

  // Create HTTP request to local service
  const options = {
    hostname: 'localhost',
    port: localPort,
    path: url,
    method: method,
    headers: headers || {}
  };

  const req = http.request(options, (res) => {
    // Send response metadata
    ws.send(JSON.stringify({
      type: 'response',
      id: id,
      status: res.statusCode,
      headers: res.headers,
      streaming: true
    }));

    // Stream response body
    res.on('data', (chunk) => {
      ws.send(JSON.stringify({
        type: 'chunk',
        id: id,
        data: chunk.toString('base64')
      }));
    });

    res.on('end', () => {
      ws.send(JSON.stringify({
        type: 'end',
        id: id
      }));
    });

    res.on('error', (error) => {
      logger.error('Local response error:', error);
      ws.send(JSON.stringify({
        type: 'response',
        id: id,
        status: 500,
        headers: {},
        body: Buffer.from(JSON.stringify({
          error: 'Local service error',
          message: error.message
        })).toString('base64')
      }));
    });
  });

  req.on('error', (error) => {
      logger.error('Local request error:', error);
    ws.send(JSON.stringify({
      type: 'response',
      id: id,
      status: 502,
      headers: {},
      body: Buffer.from(JSON.stringify({
        error: 'Connection to local service failed',
        message: error.message
      })).toString('base64')
    }));
    pendingRequests.delete(id);
  });

  // Store request for streaming
  pendingRequests.set(id, { req, chunks: [] });

  // Send request body if present (small bodies sent immediately)
  if (body) {
    req.write(Buffer.from(body, 'base64'));
    req.end();
    pendingRequests.delete(id);
  } else if (!hasBody) {
    // No body, end immediately
    req.end();
    pendingRequests.delete(id);
  }
  // If hasBody but no body field, wait for chunks
}

function handleRequestChunk(message, ws) {
  const { id, data } = message;
  const pending = pendingRequests.get(id);
  
  if (!pending) {
    return; // Request not found
  }

  // Write chunk to local request
  const chunk = Buffer.from(data, 'base64');
  pending.req.write(chunk);
}

function handleRequestEnd(message, ws) {
  const { id } = message;
  const pending = pendingRequests.get(id);
  
  if (!pending) {
    return; // Request not found
  }

  // End local request
  pending.req.end();
  pendingRequests.delete(id);
}


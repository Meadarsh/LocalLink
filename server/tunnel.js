/**
 * Tunnel connection management
 * Handles WebSocket connections and request forwarding
 */

export class TunnelManager {
  constructor() {
    this.activeTunnel = null;
    this.pendingRequests = new Map(); // requestId -> { res, chunks }
  }

  /**
   * Register a new tunnel connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} registration - Registration data from client
   */
  registerTunnel(ws, registration) {
    // Close existing tunnel if any
    if (this.activeTunnel) {
      this.activeTunnel.close();
    }

    this.activeTunnel = {
      ws,
      port: registration.port || 3000,
      registeredAt: Date.now()
    };

    // Handle tunnel disconnection
    ws.on('close', () => {
      if (this.activeTunnel && this.activeTunnel.ws === ws) {
        this.activeTunnel = null;
        // Reject all pending requests
        for (const [requestId, pending] of this.pendingRequests.entries()) {
          pending.res.status(503).json({
            error: 'Tunnel disconnected',
            message: 'The tunnel connection has been lost'
          });
        }
        this.pendingRequests.clear();
      }
    });

    ws.on('error', (error) => {
      console.error('Tunnel WebSocket error:', error);
    });

    return this.activeTunnel;
  }

  /**
   * Check if tunnel is active
   */
  isActive() {
    return this.activeTunnel !== null && 
           this.activeTunnel.ws.readyState === 1; // WebSocket.OPEN
  }

  /**
   * Forward an HTTP request to the tunnel client
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  forwardRequest(req, res) {
    // Prevent multiple handlers on the same request
    if (res.headersSent) {
      return;
    }

    if (!this.isActive()) {
      if (!res.headersSent) {
        res.status(503).json({
          error: 'No active tunnel',
          message: 'No tunnel client is currently connected'
        });
      }
      return;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    
    // Store pending request
    const pending = {
      res,
      responseStarted: false,
      responseHandler: null
    };
    this.pendingRequests.set(requestId, pending);

    // Set up response handler (will be called for all messages with this requestId)
    pending.responseHandler = (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.id !== requestId) {
          return; // Not for this request
        }

        const pendingReq = this.pendingRequests.get(requestId);
        if (!pendingReq) {
          return; // Request already handled
        }

        if (message.type === 'response') {
          // Set response headers
          if (message.headers) {
            Object.entries(message.headers).forEach(([key, value]) => {
              pendingReq.res.setHeader(key, value);
            });
          }

          // Send response status
          pendingReq.res.status(message.status || 200);
          pendingReq.responseStarted = true;

          // Handle response body (if small, send immediately)
          if (message.body) {
            const bodyBuffer = Buffer.from(message.body, 'base64');
            pendingReq.res.write(bodyBuffer);
          }

          // If no streaming expected, end response
          if (!message.streaming) {
            pendingReq.res.end();
            this.pendingRequests.delete(requestId);
            // Remove listener
            if (this.activeTunnel && this.activeTunnel.ws) {
              this.activeTunnel.ws.removeListener('message', pendingReq.responseHandler);
            }
          }
        } else if (message.type === 'chunk') {
          // Stream chunk - write directly to response
          if (!pendingReq.responseStarted && !pendingReq.res.headersSent) {
            // Start response if not started
            pendingReq.res.status(200);
            pendingReq.responseStarted = true;
          }
          if (!pendingReq.res.headersSent || pendingReq.responseStarted) {
            const chunk = Buffer.from(message.data, 'base64');
            pendingReq.res.write(chunk);
          }
        } else if (message.type === 'end') {
          // End of stream
          if (!pendingReq.responseStarted && !pendingReq.res.headersSent) {
            pendingReq.res.status(200);
          }
          if (!pendingReq.res.headersSent || pendingReq.responseStarted) {
            pendingReq.res.end();
          }
          this.pendingRequests.delete(requestId);
          // Remove listener
          if (this.activeTunnel && this.activeTunnel.ws) {
            this.activeTunnel.ws.removeListener('message', pendingReq.responseHandler);
          }
        }
      } catch (error) {
        console.error('Error handling tunnel response:', error);
        const pendingReq = this.pendingRequests.get(requestId);
        if (pendingReq) {
          if (!pendingReq.responseStarted) {
            pendingReq.res.status(500).json({
              error: 'Invalid response from tunnel',
              message: error.message
            });
          } else {
            pendingReq.res.end();
          }
          this.pendingRequests.delete(requestId);
          if (pendingReq.responseHandler && this.activeTunnel && this.activeTunnel.ws) {
            this.activeTunnel.ws.removeListener('message', pendingReq.responseHandler);
          }
        }
      }
    };

    // Register response handler
    this.activeTunnel.ws.on('message', pending.responseHandler);

    // Send request metadata first
    const requestMessage = {
      type: 'request',
      id: requestId,
      method: req.method,
      url: req.url,
      headers: this.sanitizeHeaders(req.headers),
      hasBody: req.headers['content-length'] && parseInt(req.headers['content-length']) > 0
    };

    try {
      this.activeTunnel.ws.send(JSON.stringify(requestMessage));
    } catch (error) {
      console.error('Error sending request to tunnel:', error);
      this.pendingRequests.delete(requestId);
      res.status(500).json({
        error: 'Tunnel communication error',
        message: error.message
      });
      return;
    }

    // Stream request body chunks as they arrive
    req.on('data', (chunk) => {
      if (this.activeTunnel && this.activeTunnel.ws.readyState === 1) {
        const chunkMessage = {
          type: 'chunk',
          id: requestId,
          data: chunk.toString('base64')
        };
        try {
          this.activeTunnel.ws.send(JSON.stringify(chunkMessage));
        } catch (error) {
          console.error('Error streaming request chunk:', error);
        }
      }
    });

    req.on('end', () => {
      // Send end marker for request body
      if (this.activeTunnel && this.activeTunnel.ws.readyState === 1) {
        const endMessage = {
          type: 'end',
          id: requestId,
          direction: 'request'
        };
        try {
          this.activeTunnel.ws.send(JSON.stringify(endMessage));
        } catch (error) {
          console.error('Error sending request end marker:', error);
        }
      }
    });

    req.on('error', (error) => {
      console.error('Request stream error:', error);
      const pendingReq = this.pendingRequests.get(requestId);
      if (pendingReq) {
        if (!pendingReq.responseStarted) {
          pendingReq.res.status(500).json({
            error: 'Request stream error',
            message: error.message
          });
        }
        this.pendingRequests.delete(requestId);
        if (pendingReq.responseHandler) {
          this.activeTunnel.ws.removeListener('message', pendingReq.responseHandler);
        }
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      const pendingReq = this.pendingRequests.get(requestId);
      if (pendingReq) {
        if (!pendingReq.responseStarted) {
          pendingReq.res.status(504).json({
            error: 'Request timeout',
            message: 'The tunnel client did not respond in time'
          });
        } else {
          pendingReq.res.end();
        }
        this.pendingRequests.delete(requestId);
        if (pendingReq.responseHandler) {
          this.activeTunnel.ws.removeListener('message', pendingReq.responseHandler);
        }
      }
    }, 30000);
  }

  /**
   * Sanitize headers - remove hop-by-hop headers
   */
  sanitizeHeaders(headers) {
    const hopByHop = [
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailers',
      'transfer-encoding',
      'upgrade'
    ];

    const sanitized = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!hopByHop.includes(key.toLowerCase())) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Get tunnel status
   */
  getStatus() {
    if (!this.activeTunnel) {
      return {
        connected: false,
        port: null,
        uptime: null
      };
    }

    return {
      connected: this.isActive(),
      port: this.activeTunnel.port,
      uptime: Date.now() - this.activeTunnel.registeredAt
    };
  }
}


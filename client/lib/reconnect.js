/**
 * Auto-reconnect logic with exponential backoff
 */

export class ReconnectManager {
  constructor(options = {}) {
    this.attempts = 0;
    this.maxAttempts = options.maxAttempts || Infinity;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 60000; // 60 seconds
    this.reconnectTimeout = null;
    this.isReconnecting = false;
    this.onReconnect = options.onReconnect || (() => {});
    this.onReconnectAttempt = options.onReconnectAttempt || (() => {});
  }

  /**
   * Calculate delay for current attempt using exponential backoff
   */
  getDelay() {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.attempts),
      this.maxDelay
    );
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay; // Up to 30% jitter
    return Math.floor(delay + jitter);
  }

  /**
   * Schedule a reconnection attempt
   */
  async reconnect(connectFn) {
    if (this.isReconnecting) {
      return; // Already reconnecting
    }

    this.isReconnecting = true;
    this.attempts++;

    if (this.attempts > this.maxAttempts) {
      this.isReconnecting = false;
      throw new Error('Max reconnection attempts reached');
    }

    const delay = this.getDelay();
    
    // Notify about reconnection attempt
    this.onReconnectAttempt(this.attempts, delay);

    return new Promise((resolve, reject) => {
      this.reconnectTimeout = setTimeout(async () => {
        try {
          const result = await connectFn();
          // Reset attempts on successful connection
          this.attempts = 0;
          this.isReconnecting = false;
          this.onReconnect();
          resolve(result);
        } catch (error) {
          this.isReconnecting = false;
          // Retry
          try {
            const result = await this.reconnect(connectFn);
            resolve(result);
          } catch (retryError) {
            reject(retryError);
          }
        }
      }, delay);
    });
  }

  /**
   * Cancel pending reconnection
   */
  cancel() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isReconnecting = false;
    this.attempts = 0;
  }

  /**
   * Reset reconnection state (on successful connection)
   */
  reset() {
    this.attempts = 0;
    this.isReconnecting = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}


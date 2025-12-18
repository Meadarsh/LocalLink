/**
 * Status display and tracking
 * Shows current tunnel status with uptime
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getConfig } from './config.js';
import { logger } from './logger.js';

const STATUS_DIR = join(homedir(), '.opentunnel');
const STATUS_FILE = join(STATUS_DIR, 'status.json');

/**
 * Format uptime in human-readable format
 */
function formatUptime(ms) {
  if (!ms || ms < 0) return 'N/A';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Update tunnel status
 */
export async function updateStatus(status) {
  try {
    await fs.mkdir(STATUS_DIR, { recursive: true });
    await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
  } catch (error) {
    logger.error('Error updating status:', error);
  }
}

/**
 * Clear tunnel status (on disconnect)
 */
export async function clearStatus() {
  try {
    await fs.unlink(STATUS_FILE);
  } catch (error) {
    // File doesn't exist, that's fine
  }
}

/**
 * Get current status
 */
export async function getStatus() {
  try {
    const data = await fs.readFile(STATUS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Show status to user
 */
export async function showStatus() {
  const config = await getConfig();
  const status = await getStatus();
  
  if (!config) {
    logger.warn('Status: Not configured');
    logger.log('Run: opentunnel init <https://domain>');
    return;
  }

  if (!status || !status.connected) {
    logger.warn('Status: Disconnected');
    logger.info(`Domain: ${config.domain}`);
    logger.info('Port: Not connected');
    logger.info('Uptime: N/A');
    return;
  }

  const uptime = status.connectedAt 
    ? Date.now() - new Date(status.connectedAt).getTime()
    : 0;

  logger.success('Status: Connected');
  logger.info(`Domain: ${status.domain || config.domain}`);
  logger.info(`Port: ${status.port || 'N/A'}`);
  logger.info(`Uptime: ${formatUptime(uptime)}`);
}


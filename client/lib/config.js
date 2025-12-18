/**
 * Configuration management
 * Persists domain configuration locally
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.opentunnel');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Initialize configuration with domain
 * @param {string} domain - Server domain (must start with http:// or https://)
 */
export async function initConfig(domain) {
  // Validate domain
  if (!domain || typeof domain !== 'string') {
    throw new Error('Domain is required');
  }

  // Normalize domain (remove trailing slash)
  domain = domain.trim().replace(/\/$/, '');

  if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
    throw new Error('Domain must start with http:// or https://');
  }

  // Basic URL validation
  try {
    new URL(domain);
  } catch (error) {
    throw new Error('Invalid domain URL format');
  }

  // Ensure config directory exists
  await fs.mkdir(CONFIG_DIR, { recursive: true });

  // Load existing config if any
  let existingConfig = null;
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    existingConfig = JSON.parse(data);
  } catch (error) {
    // File doesn't exist, that's fine
  }

  // Save config
  const config = {
    domain: domain,
    createdAt: existingConfig?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  
  return config;
}

/**
 * Get current configuration
 * @returns {Promise<Object|null>} Configuration object or null if not configured
 */
export async function getConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    const config = JSON.parse(data);
    
    // Validate config structure
    if (!config.domain) {
      return null;
    }
    
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Get config file path (for debugging/info)
 */
export function getConfigPath() {
  return CONFIG_FILE;
}


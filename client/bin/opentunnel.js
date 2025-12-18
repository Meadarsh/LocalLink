#!/usr/bin/env node

/**
 * OpenTunnel CLI Entry Point
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import minimist from 'minimist';
import { createTunnel } from '../lib/tunnel.js';
import { initConfig, getConfig } from '../lib/config.js';
import { showStatus } from '../lib/status.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = minimist(process.argv.slice(2));

// Get command (first non-flag argument)
const command = args._[0];

async function main() {
  try {
    if (command === 'init') {
      // Initialize configuration
      const domain = args._[1];
      if (!domain) {
        logger.error('Error: Domain required');
        logger.log('Usage: opentunnel init <https://domain>');
        process.exit(1);
      }

      await initConfig(domain);
      logger.success(`✓ Configuration saved: ${domain}`);
      process.exit(0);
    } else if (command === 'status') {
      // Show status
      await showStatus();
      process.exit(0);
    } else {
      // Default: start tunnel
      const port = parseInt(command) || parseInt(args.port) || 3000;
      
      // Get config
      const config = await getConfig();
      if (!config || !config.domain) {
        logger.error('Error: No domain configured');
        logger.log('Run: opentunnel init <https://domain>');
        process.exit(1);
      }

      // Start tunnel
      await createTunnel(config.domain, port);
    }
  } catch (error) {
    logger.error('Error:', error.message);
    process.exit(1);
  }
}

main();


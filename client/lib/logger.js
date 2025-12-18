/**
 * Colored logging system
 * Provides color-coded log messages
 */

import chalk from 'chalk';

export const logger = {
  /**
   * Success messages (green)
   */
  success: (...args) => {
    console.log(chalk.green(...args));
  },

  /**
   * Warning/reconnecting messages (yellow)
   */
  warn: (...args) => {
    console.log(chalk.yellow(...args));
  },

  /**
   * Error messages (red)
   */
  error: (...args) => {
    console.error(chalk.red(...args));
  },

  /**
   * Info messages (cyan)
   */
  info: (...args) => {
    console.log(chalk.cyan(...args));
  },

  /**
   * Regular log (no color)
   */
  log: (...args) => {
    console.log(...args);
  }
};


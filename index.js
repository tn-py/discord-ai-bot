require('dotenv').config();
const logger = require('./src/utils/logger');

// Set unhandled rejection handler before requiring app
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason,
    promise
  });
});

// Import and start the bot
try {
  require('./src/app');
  logger.info('Bot startup initiated');
} catch (error) {
  logger.error('Critical error during bot startup:', error);
  process.exit(1);
}
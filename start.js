const { syncCommands } = require('./src/utils/syncCommands');
const logger = require('./src/utils/logger');
const { spawn } = require('child_process');

async function start() {
  try {
    // First clear and sync commands
    logger.info('Clearing and syncing Discord commands...');
    await syncCommands({ clear: true });
    
    // Start the bot
    logger.info('Starting Discord bot...');
    const bot = spawn('node', ['index.js'], {
      stdio: 'inherit'
    });

    bot.on('error', (error) => {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    });

    // Handle bot process exit
    bot.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`Bot process exited with code ${code}`);
        process.exit(code);
      }
    });

  } catch (error) {
    logger.error('Startup error:', error);
    process.exit(1);
  }
}

// Start the application
start();
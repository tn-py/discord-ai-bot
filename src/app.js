const { Client } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');
const { loadEvents } = require('./utils/eventLoader');
const { validateEnv } = require('./utils/errors');

class DiscordBot {
  constructor() {
    this.client = new Client({
      intents: config.discord.intents
    });
  }

  /**
   * Initialize the bot
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Validate environment variables before starting
      validateEnv([
        'DISCORD_BOT_TOKEN',
        'DISCORD_GUILD_ID',
        'OPENAI_API_KEY',
        'OPENAI_ASSISTANT_ID',
        'GOOGLE_GEMINI_API_KEY',
        'OPENWEATHER_API_KEY'
      ]);

      // Load event handlers
      await loadEvents(this.client);

      // Login to Discord
      await this.client.login(process.env.DISCORD_BOT_TOKEN);
      
      logger.info('Bot initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize bot:', error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown the bot
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      // Perform cleanup
      this.client.destroy();
      logger.info('Bot shutdown successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

// Handle process events
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  try {
    await bot.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Starting graceful shutdown...');
  try {
    await bot.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Create and start bot
const bot = new DiscordBot();
bot.initialize().catch(error => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});

module.exports = bot;
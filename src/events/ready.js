const logger = require('../utils/logger');
const commandHandler = require('../utils/commandHandler');
const config = require('../config');
const { validateEnv } = require('../utils/errors');

module.exports = {
  name: 'ready',
  once: true,

  /**
   * Handle the ready event
   * @param {Client} client - Discord client
   */
  async execute(client) {
    try {
      logger.info(`Logged in as ${client.user.tag}`);

      // Validate required environment variables
      validateEnv([
        'DISCORD_BOT_TOKEN',
        'DISCORD_GUILD_ID',
        'OPENAI_API_KEY',
        'OPENAI_ASSISTANT_ID',
        'GOOGLE_GEMINI_API_KEY',
        'OPENWEATHER_API_KEY'
      ]);

      // Load and register commands
      await commandHandler.loadCommands();
      
      const guild = await client.guilds.fetch(config.discord.guildId);
      if (!guild) {
        throw new Error(`Guild not found: ${config.discord.guildId}`);
      }

      await commandHandler.registerCommands(client, guild.id);
      
      // Log successful initialization
      logger.info('Bot initialization completed', {
        guildName: guild.name,
        commandCount: commandHandler.getAllCommands().size
      });

      // Set bot status
      await client.user.setPresence({
        activities: [{
          name: '/help for commands',
          type: 'WATCHING'
        }],
        status: 'online'
      });
    } catch (error) {
      logger.error('Error in ready event:', error);
      // Exit process on critical initialization failure
      process.exit(1);
    }
  }
};
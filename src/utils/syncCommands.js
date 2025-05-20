const { REST, Routes } = require('discord.js');
const logger = require('./logger');
const commandHandler = require('./commandHandler');
const { validateEnv } = require('./errors');

/**
 * Sync commands with Discord
 * @param {Object} options - Sync options
 * @param {boolean} [options.global=false] - Whether to register commands globally
 * @param {boolean} [options.clear=false] - Whether to clear existing commands before syncing
 * @returns {Promise<void>}
 */
async function syncCommands({ global = false, clear = false } = {}) {
  try {
    // Validate required environment variables
    validateEnv(['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID']);

    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    // Initialize REST API client
    const rest = new REST({ version: '10' }).setToken(token);

    // Determine route based on global flag
    const route = global
      ? Routes.applicationCommands(clientId)
      : Routes.applicationGuildCommands(clientId, guildId);

    // Clear existing commands if requested
    if (clear) {
      logger.info('Clearing existing commands...');
      await rest.put(route, { body: [] });
      logger.info(`Successfully cleared all commands ${global ? 'globally' : `from guild ${guildId}`}`);
    }

    // Load all commands
    await commandHandler.loadCommands();
    const commands = commandHandler.getAllCommands();
    const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

    // Sync new commands
    logger.info(`Starting to sync ${commandData.length} commands...`);
    await rest.put(route, { body: commandData });
    logger.info(`Successfully synced ${commandData.length} commands ${global ? 'globally' : `to guild ${guildId}`}`);
  } catch (error) {
    logger.error('Error syncing commands:', error);
    throw error;
  }
}

// If script is run directly, execute sync
if (require.main === module) {
  // Load environment variables if not already loaded
  require('dotenv').config();
  
  const global = process.argv.includes('--global');
  const clear = process.argv.includes('--clear');
  syncCommands({ global, clear })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { syncCommands };
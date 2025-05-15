const { Collection } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { ValidationError } = require('./errors');

class CommandHandler {
  constructor() {
    this.commands = new Collection();
  }

  /**
   * Load all command modules from the commands directory
   * @returns {Promise<void>}
   */
  async loadCommands() {
    try {
      const commandsPath = path.join(__dirname, '..', 'commands');
      const commandFiles = await fs.readdir(commandsPath);

      for (const file of commandFiles) {
        if (!file.endsWith('.js')) continue;

        try {
          const filePath = path.join(commandsPath, file);
          const command = require(filePath);

          // Validate command structure
          this.validateCommand(command);

          // Set command in collection
          this.commands.set(command.data.name, command);
          logger.info(`Loaded command: ${command.data.name}`);
        } catch (error) {
          logger.error(`Error loading command file ${file}:`, error);
        }
      }

      logger.info(`Loaded ${this.commands.size} commands successfully`);
    } catch (error) {
      logger.error('Error loading commands:', error);
      throw error;
    }
  }

  /**
   * Validate command structure
   * @param {Object} command - Command module
   * @throws {ValidationError} - If command structure is invalid
   */
  validateCommand(command) {
    const requiredProperties = ['data', 'execute'];
    const missingProperties = requiredProperties.filter(prop => !command[prop]);

    if (missingProperties.length > 0) {
      throw new ValidationError(
        `Invalid command structure. Missing properties: ${missingProperties.join(', ')}`
      );
    }

    if (!command.data.name || !command.data.description) {
      throw new ValidationError(
        'Invalid command data. Name and description are required.'
      );
    }
  }

  /**
   * Register commands with Discord
   * @param {Client} client - Discord client instance
   * @param {string} guildId - Guild ID for registering commands
   * @returns {Promise<void>}
   */
  async registerCommands(client, guildId) {
    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) {
        throw new Error(`Guild not found: ${guildId}`);
      }

      const commandData = this.commands.map(command => command.data.toJSON());
      
      // Register commands with the guild
      await guild.commands.set(commandData);
      logger.info(`Registered ${commandData.length} commands for guild: ${guild.name}`);
    } catch (error) {
      logger.error('Error registering commands:', error);
      throw error;
    }
  }

  /**
   * Handle an interaction
   * @param {Interaction} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = this.commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}:`, error);
      throw error;
    }
  }

  /**
   * Get command by name
   * @param {string} name - Command name
   * @returns {Object|undefined} - Command module or undefined if not found
   */
  getCommand(name) {
    return this.commands.get(name);
  }

  /**
   * Get all registered commands
   * @returns {Collection} - Collection of commands
   */
  getAllCommands() {
    return this.commands;
  }

  /**
   * Reload a specific command
   * @param {string} commandName - Name of command to reload
   * @returns {Promise<void>}
   */
  async reloadCommand(commandName) {
    try {
      const command = this.getCommand(commandName);
      if (!command) {
        throw new Error(`Command not found: ${commandName}`);
      }

      const commandPath = path.join(__dirname, '..', 'commands', `${commandName}.js`);
      
      // Remove command from cache and collection
      delete require.cache[require.resolve(commandPath)];
      this.commands.delete(commandName);

      // Load command again
      const newCommand = require(commandPath);
      this.validateCommand(newCommand);
      this.commands.set(newCommand.data.name, newCommand);

      logger.info(`Reloaded command: ${commandName}`);
    } catch (error) {
      logger.error(`Error reloading command ${commandName}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new CommandHandler();
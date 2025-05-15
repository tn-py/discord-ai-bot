const logger = require('../utils/logger');
const commandHandler = require('../utils/commandHandler');
const { handleInteractionError } = require('../utils/errors');

module.exports = {
  name: 'interactionCreate',
  
  /**
   * Handle interaction create events
   * @param {Interaction} interaction - Discord interaction
   */
  async execute(interaction) {
    try {
      // Only handle chat input commands
      if (!interaction.isChatInputCommand()) return;

      logger.debug('Interaction received', {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId
      });

      // Get command handler
      const command = commandHandler.getCommand(interaction.commandName);
      
      if (!command) {
        logger.warn(`Unknown command: ${interaction.commandName}`);
        await interaction.reply({
          content: 'Sorry, I don\'t recognize that command.',
          ephemeral: true
        });
        return;
      }

      // Execute command
      await command.execute(interaction);

      logger.debug('Command executed successfully', {
        commandName: interaction.commandName,
        userId: interaction.user.id
      });
    } catch (error) {
      await handleInteractionError(error, interaction);
    }
  }
};
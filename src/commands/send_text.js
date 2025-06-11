const { SlashCommandBuilder } = require('discord.js');
const twilioService = require('../services/twilio');
const logger = require('../utils/logger');
const { handleInteractionError } = require('../utils/errors'); // Assuming you have this error handler

module.exports = {
  data: new SlashCommandBuilder()
    .setName('send_text')
    .setDescription('Sends a text message to a specified phone number.')
    .addStringOption(option =>
      option.setName('phone_number')
        .setDescription('The phone number to send the message to (e.g., +12345678900)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The content of the message to send.')
        .setRequired(true)),

  async execute(interaction) {
    try {
      if (!twilioService.isConfigured()) {
        await interaction.reply({
          content: 'The SMS service is not configured. Please contact the bot administrator.',
          ephemeral: true,
        });
        return;
      }

      const phoneNumber = interaction.options.getString('phone_number');
      const messageContent = interaction.options.getString('message');

      // Basic validation for phone number format (E.164)
      // More robust validation should ideally be in the Twilio service or a dedicated utility
      if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
        await interaction.reply({
          content: 'Invalid phone number format. Please use E.164 format (e.g., +12345678900).',
          ephemeral: true,
        });
        return;
      }

      // Defer reply as sending SMS can take time
      await interaction.deferReply({ ephemeral: true });

      try {
        await twilioService.sendTextMessage(phoneNumber, messageContent);
        await interaction.editReply({
          content: `Message sent successfully to ${phoneNumber}!`,
        });
        logger.info(`Successfully sent SMS via /send_text command to ${phoneNumber} by user ${interaction.user.tag}`);
      } catch (error) {
        logger.error(`Failed to send SMS via /send_text command for user ${interaction.user.tag}:`, error);
        await interaction.editReply({
          content: `Failed to send message: ${error.message || 'An unexpected error occurred.'}`,
        });
      }

    } catch (error) {
      // This catch is for errors during initial interaction handling (e.g., deferReply)
      // or if handleInteractionError is not used for the Twilio call.
      logger.error('Error in send_text command execution:', error);
      // Use handleInteractionError or a direct reply if it's not already handled
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content: 'An error occurred while processing your request.'});
      }
      // If you have a generic error handler like handleInteractionError, you might call it here:
      // await handleInteractionError(error, interaction);
    }
  },
};

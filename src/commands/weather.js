const { SlashCommandBuilder } = require('discord.js');
const weatherService = require('../services/weather');
const logger = require('../utils/logger');
const { handleInteractionError } = require('../utils/errors');

module.exports = {
  // Command definition
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get the weather forecast')
    .addStringOption(option => 
      option
        .setName('location')
        .setDescription('City name or zip code')
        .setRequired(true)
    ),

  /**
   * Execute the weather command
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async execute(interaction) {
    try {
      // Defer reply since weather API calls might take time
      await interaction.deferReply();

      const location = interaction.options.getString('location');
      logger.info(`Weather request for location: ${location}`, {
        userId: interaction.user.id,
        guildId: interaction.guildId
      });

      // Get weather forecast
      const forecast = await weatherService.getWeatherForecast(
        location,
        interaction.user.id
      );

      // Format and send response
      const response = weatherService.formatWeatherMessage(forecast);
      await interaction.editReply(response);

      logger.debug('Weather command completed successfully', {
        userId: interaction.user.id,
        location: forecast.location
      });
    } catch (error) {
      await handleInteractionError(error, interaction);
    }
  }
};
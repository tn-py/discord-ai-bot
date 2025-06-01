const { SlashCommandBuilder } = require('discord.js');
const openaiService = require('../services/openai');
const logger = require('../utils/logger');
const { handleInteractionError } = require('../utils/errors');

module.exports = {
  // Command definition
  data: new SlashCommandBuilder()
    .setName('imagine')
    .setDescription('Generate an image using AI')
    .addStringOption(option => 
      option
        .setName('prompt')
        .setDescription('The prompt for the image')
        .setRequired(true)
        .setMaxLength(1000)
    ),

  /**
   * Execute the imagine command
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async execute(interaction) {
    try {
      await interaction.deferReply();

      const prompt = interaction.options.getString('prompt');
      logger.info(`Image generation request received`, {
        userId: interaction.user.id,
        promptLength: prompt.length
      });

      const imageUrl = await openaiService.generateImage(
        prompt,
        interaction.user.id
      );

      await interaction.editReply({
        content: `Here's your image:\n${imageUrl}`,
        files: [imageUrl]
      });

      logger.debug('OpenAI image generation successful', {
        userId: interaction.user.id
      });
    } catch (error) {
      await handleInteractionError(error, interaction);
    }
  }
};
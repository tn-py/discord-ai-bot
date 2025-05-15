const { SlashCommandBuilder } = require('discord.js');
const openaiService = require('../services/openai');
const geminiService = require('../services/gemini');
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

      try {
        // Try OpenAI first
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
      } catch (openaiError) {
        logger.warn('OpenAI image generation failed, falling back to Gemini', {
          error: openaiError.message
        });

        try {
          // Fallback to Gemini
          const description = await geminiService.generateImageDescription(
            prompt,
            interaction.user.id
          );

          await interaction.editReply({
            content: [
              '⚠️ I was unable to generate an image, but here\'s a description of what it might look like:',
              '',
              description
            ].join('\n')
          });

          logger.debug('Gemini fallback description generated', {
            userId: interaction.user.id
          });
        } catch (geminiError) {
          logger.error('Both image generation services failed', {
            openaiError: openaiError.message,
            geminiError: geminiError.message
          });

          throw new Error('Failed to generate image or description');
        }
      }
    } catch (error) {
      await handleInteractionError(error, interaction);
    }
  }
};
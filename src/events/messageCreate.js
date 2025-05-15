const logger = require('../utils/logger');
const chatCommand = require('../commands/chat');
const openaiService = require('../services/openai');
const geminiService = require('../services/gemini');
const { handleMessageError } = require('../utils/errors');

module.exports = {
  name: 'messageCreate',
  
  /**
   * Handle message create events
   * @param {Message} message - Discord message
   */
  async execute(message) {
    try {
      // Ignore bot messages
      if (message.author.bot) return;

      logger.debug('Message received', {
        userId: message.author.id,
        channelId: message.channel.id,
        guildId: message.guild?.id,
        contentLength: message.content.length
      });

      // Handle active chat sessions
      if (chatCommand.hasActiveSession(message.author.id)) {
        await chatCommand.handleMessage(message);
        return;
      }

      // Check if message activates GiGi
      if (geminiService.isActivated(message.content)) {
        logger.debug('GiGi activation detected', {
          userId: message.author.id
        });

        try {
          // Try OpenAI Assistant first
          const assistantResponse = await openaiService.processMessage(
            message.author.id,
            message.content
          );

          await message.reply(assistantResponse);

          logger.debug('OpenAI Assistant response sent', {
            userId: message.author.id
          });
        } catch (openaiError) {
          logger.warn('OpenAI Assistant failed, falling back to Gemini', {
            error: openaiError.message
          });

          try {
            // Fallback to Gemini
            const geminiResponse = await geminiService.processWithFallback(
              message.author.id,
              message.content
            );

            if (geminiResponse) {
              await message.reply(geminiResponse);
              
              logger.debug('Gemini fallback response sent', {
                userId: message.author.id
              });
            }
          } catch (geminiError) {
            logger.error('Both AI services failed', {
              openaiError: openaiError.message,
              geminiError: geminiError.message
            });

            await message.reply(
              'I\'m having trouble connecting to my resources right now. Please try again later.'
            );
          }
        }
      }
    } catch (error) {
      await handleMessageError(error, message);
    }
  }
};
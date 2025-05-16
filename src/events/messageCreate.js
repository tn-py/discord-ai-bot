const logger = require('../utils/logger');
const chatCommand = require('../commands/chat');
const openaiService = require('../services/openai');
const { handleMessageError } = require('../utils/errors');

module.exports = {
  name: 'messageCreate',
  
  /**
   * Check if message contains the bot's name (GiGi)
   * @param {string} content - Message content
   * @returns {boolean}
   */
  isGiGiMentioned(content) {
    const botNameRegex = /GiGi/i; // Case-insensitive match for "GiGi"
    return botNameRegex.test(content);
  },

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

      // Check if message mentions GiGi
      if (this.isGiGiMentioned(message.content)) {
        logger.debug('GiGi mention detected', {
          userId: message.author.id
        });

        try {
          // Process with OpenAI Assistant
          const assistantResponse = await openaiService.processMessage(
            message.author.id,
            message.content
          );

          await message.reply(assistantResponse);

          logger.debug('OpenAI Assistant response sent', {
            userId: message.author.id
          });
        } catch (error) {
          logger.error('OpenAI Assistant failed:', error);
          await message.reply(
            'I\'m having trouble connecting to my resources right now. Please try again later.'
          );
        }
      }
    } catch (error) {
      await handleMessageError(error, message);
    }
  }
};
const { SlashCommandBuilder } = require('discord.js');
const openaiService = require('../services/openai');
const geminiService = require('../services/gemini');
const logger = require('../utils/logger');
const { handleInteractionError } = require('../utils/errors');

// Store active chat sessions
const activeSessions = new Map();

// Session cleanup interval (1 hour)
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > 3600000) {
      activeSessions.delete(userId);
      logger.debug(`Cleaned up inactive chat session for user: ${userId}`);
    }
  }
}, 3600000);

module.exports = {
  // Command definition
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Start a conversation with the AI')
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('Start a new chat session')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End the current chat session')
    ),

  /**
   * Execute the chat command
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;

      if (subcommand === 'start') {
        // Check if user already has an active session
        if (activeSessions.has(userId)) {
          return interaction.reply({
            content: 'You already have an active chat session. Use `/chat end` to end it first.',
            ephemeral: true
          });
        }

        // Create new session
        activeSessions.set(userId, {
          messages: [],
          lastActivity: Date.now(),
          useGemini: false // Start with OpenAI by default
        });

        await interaction.reply({
          content: [
            '🤖 Chat session started! You can now talk to me directly.',
            'Your messages will be processed until you use `/chat end`.',
            '',
            '**Note:** This session will automatically end after 1 hour of inactivity.'
          ].join('\n')
        });

        logger.info(`Chat session started for user: ${userId}`);
      } else if (subcommand === 'end') {
        // End session if exists
        if (activeSessions.has(userId)) {
          activeSessions.delete(userId);
          await interaction.reply({
            content: '👋 Chat session ended. Thanks for talking with me!',
            ephemeral: true
          });
          logger.info(`Chat session ended for user: ${userId}`);
        } else {
          await interaction.reply({
            content: 'You don\'t have an active chat session.',
            ephemeral: true
          });
        }
      }
    } catch (error) {
      await handleInteractionError(error, interaction);
    }
  },

  /**
   * Handle regular message for active chat sessions
   * @param {Message} message - Discord message
   */
  async handleMessage(message) {
    const userId = message.author.id;
    const session = activeSessions.get(userId);

    if (!session) return; // Not an active chat session

    try {
      // Update last activity
      session.lastActivity = Date.now();

      if (!session.useGemini) {
        try {
          // Try OpenAI first
          session.messages.push({ role: 'user', content: message.content });
          
          const reply = await openaiService.createChatCompletion(
            session.messages,
            userId
          );

          session.messages.push({ role: 'assistant', content: reply });
          await message.reply(reply);

          logger.debug('OpenAI chat response sent', {
            userId,
            messageCount: session.messages.length
          });
        } catch (openaiError) {
          logger.warn('OpenAI chat failed, switching to Gemini', {
            error: openaiError.message
          });

          // Switch to Gemini for this session
          session.useGemini = true;
          session.messages = []; // Reset messages for Gemini

          // Try Gemini
          const geminiResponse = await geminiService.processMessage(
            userId,
            message.content
          );

          await message.reply(geminiResponse);

          logger.debug('Switched to Gemini for chat session', { userId });
        }
      } else {
        // Already using Gemini
        const response = await geminiService.processMessage(
          userId,
          message.content
        );

        await message.reply(response);

        logger.debug('Gemini chat response sent', { userId });
      }
    } catch (error) {
      logger.error('Error in chat message handling:', error);
      await message.reply('Sorry, I encountered an error processing your message. Please try again.');
    }
  },

  /**
   * Check if a user has an active chat session
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  hasActiveSession(userId) {
    return activeSessions.has(userId);
  },

  /**
   * Get active sessions count
   * @returns {number}
   */
  getActiveSessionsCount() {
    return activeSessions.size;
  }
};
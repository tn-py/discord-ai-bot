const { OpenAI } = require('openai');
const config = require('../config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const rateLimiter = require('../utils/rateLimiter');
const { APIError, ValidationError } = require('../utils/errors');

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.ai.openai.apiKey,
    });
    this.activeThreads = new Map();

    // Cleanup old threads periodically
    setInterval(() => this.cleanupOldThreads(), 3600000); // Every hour
  }

  /**
   * Generate an image using DALL-E
   * @param {string} prompt - Image generation prompt
   * @param {string} userId - User ID for rate limiting
   * @returns {Promise<string>} - Generated image URL
   */
  async generateImage(prompt, userId) {
    try {
      // Check rate limit
      rateLimiter.checkLimit(userId, 'image_generation', {
        windowMs: 300000, // 5 minutes
        maxRequests: 3
      });

      // Check cache
      const cacheKey = `image:${prompt}`;
      const cachedUrl = cache.get(cacheKey);
      if (cachedUrl) {
        logger.debug('Returning cached image URL for prompt:', prompt);
        return cachedUrl;
      }

      // Generate image
      const response = await this.client.images.generate({
        prompt,
        n: 1,
        size: '512x512',
      });

      if (!response.data || response.data.length === 0) {
        throw new APIError('No image generated', 500, 'OpenAI');
      }

      const imageUrl = response.data[0].url;
      
      // Cache the result
      cache.set(cacheKey, imageUrl, 3600); // Cache for 1 hour

      return imageUrl;
    } catch (error) {
      logger.error('Error generating image:', error);
      throw new APIError(
        'Failed to generate image',
        error.status || 500,
        'OpenAI'
      );
    }
  }

  /**
   * Get or create a conversation thread
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Thread data
   */
  async getOrCreateThread(userId) {
    try {
      let threadData = this.activeThreads.get(userId);
      
      if (!threadData) {
        const thread = await this.client.beta.threads.create();
        threadData = {
          threadId: thread.id,
          messages: [],
          lastActivity: Date.now()
        };
        this.activeThreads.set(userId, threadData);
        logger.debug(`Created new thread for user: ${userId}`);
      }

      // Update last activity
      threadData.lastActivity = Date.now();
      return threadData;
    } catch (error) {
      logger.error('Error managing thread:', error);
      throw new APIError(
        'Failed to manage conversation thread',
        error.status || 500,
        'OpenAI'
      );
    }
  }

  /**
   * Process a message using the OpenAI Assistant
   * @param {string} userId - User ID
   * @param {string} content - Message content
   * @returns {Promise<string>} - Assistant's response
   */
  async processMessage(userId, content) {
    try {
      // Check rate limit
      rateLimiter.checkLimit(userId, 'chat', {
        windowMs: 60000, // 1 minute
        maxRequests: 5
      });

      const { threadId } = await this.getOrCreateThread(userId);
      
      // Add message to thread
      await this.client.beta.threads.messages.create(threadId, {
        role: 'user',
        content
      });
      
      // Run assistant
      const run = await this.client.beta.threads.runs.create(threadId, {
        assistant_id: config.ai.openai.assistantId
      });
      
      // Wait for completion
      const response = await this.waitForCompletion(threadId, run.id);
      return response;
    } catch (error) {
      logger.error('Error processing message:', error);
      throw new APIError(
        'Failed to process message',
        error.status || 500,
        'OpenAI'
      );
    }
  }

  /**
   * Wait for assistant run completion
   * @param {string} threadId - Thread ID
   * @param {string} runId - Run ID
   * @returns {Promise<string>} - Assistant's response
   */
  async waitForCompletion(threadId, runId) {
    const startTime = Date.now();
    const timeout = config.ai.openai.timeout;
    
    while (true) {
      const runStatus = await this.client.beta.threads.runs.retrieve(threadId, runId);
      
      if (runStatus.status === 'completed') {
        const messages = await this.client.beta.threads.messages.list(threadId);
        const assistantMessages = messages.data.filter(msg => msg.role === 'assistant');
        
        if (assistantMessages.length > 0) {
          return assistantMessages[0].content[0].text.value;
        }
        throw new Error('No assistant messages found');
      }
      
      if (runStatus.status === 'failed' || Date.now() - startTime > timeout) {
        throw new Error(`Assistant run failed or timed out. Status: ${runStatus.status}`);
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Clean up old conversation threads
   */
  async cleanupOldThreads() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [userId, threadData] of this.activeThreads.entries()) {
      if (now - threadData.lastActivity > maxAge) {
        this.activeThreads.delete(userId);
        logger.debug(`Cleaned up inactive thread for user: ${userId}`);
      }
    }
  }

  /**
   * Create a simple chat completion
   * @param {Array} messages - Conversation history
   * @param {string} userId - User ID for rate limiting
   * @returns {Promise<string>} - AI response
   */
  async createChatCompletion(messages, userId) {
    try {
      // Check rate limit
      rateLimiter.checkLimit(userId, 'chat_completion', {
        windowMs: 60000, // 1 minute
        maxRequests: 5
      });

      const response = await this.client.chat.completions.create({
        model: config.ai.openai.model,
        messages,
        max_tokens: config.ai.openai.maxTokens
      });

      return response.choices[0].message.content;
    } catch (error) {
      logger.error('Error creating chat completion:', error);
      throw new APIError(
        'Failed to create chat completion',
        error.status || 500,
        'OpenAI'
      );
    }
  }
}

// Export singleton instance
module.exports = new OpenAIService();
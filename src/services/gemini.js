const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const rateLimiter = require('../utils/rateLimiter');
const { APIError } = require('../utils/errors');

class GeminiService {
  constructor() {
    this.client = new GoogleGenerativeAI(config.ai.gemini.apiKey);
    this.model = this.client.getModel(config.ai.gemini.model);
  }

  /**
   * Get safety settings for Gemini
   * @returns {Array} Array of safety settings
   */
  getSafetySettings() {
    return [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ];
  }

  /**
   * Get generation config for Gemini
   * @returns {Object} Generation configuration
   */
  getGenerationConfig() {
    return {
      temperature: config.ai.gemini.temperature,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    };
  }

  /**
   * Process a message using Gemini
   * @param {string} userId - User ID for rate limiting
   * @param {string} content - Message content
   * @param {boolean} isFallback - Whether this is a fallback request
   * @returns {Promise<string>} Gemini's response
   */
  async processMessage(userId, content, isFallback = false) {
    try {
      // Check rate limit
      rateLimiter.checkLimit(userId, 'gemini_chat', {
        windowMs: 60000, // 1 minute
        maxRequests: 5
      });

      // Check cache for non-fallback requests
      if (!isFallback) {
        const cacheKey = `gemini:${content}`;
        const cachedResponse = cache.get(cacheKey);
        if (cachedResponse) {
          logger.debug('Returning cached Gemini response');
          return cachedResponse;
        }
      }

      const chat = this.model.startChat({
        generationConfig: this.getGenerationConfig(),
        history: [],
        safetySettings: this.getSafetySettings()
      });

      // Add system prompt
      const systemPrompt = isFallback 
        ? config.ai.gemini.fallbackPrompt 
        : config.ai.gemini.initialPrompt;
      
      await chat.sendMessage(systemPrompt);
      
      // Send user message and get response
      const result = await chat.sendMessage(content);
      const response = result.response.text();

      // Cache non-fallback responses
      if (!isFallback) {
        cache.set(`gemini:${content}`, response, 1800); // Cache for 30 minutes
      }

      return response;
    } catch (error) {
      logger.error('Error processing message with Gemini:', error);
      throw new APIError(
        'Failed to process message with Gemini',
        error.status || 500,
        'Gemini'
      );
    }
  }

  /**
   * Check if a message should activate GiGi
   * @param {string} content - Message content
   * @returns {boolean} Whether GiGi should be activated
   */
  isActivated(content) {
    const activationName = config.ai.gemini.activationName || 'GiGi';
    return content.toLowerCase().includes(activationName.toLowerCase());
  }

  /**
   * Process a message with fallback handling
   * @param {string} userId - User ID
   * @param {string} content - Message content
   * @returns {Promise<string>} AI response
   */
  async processWithFallback(userId, content) {
    try {
      // First try normal processing
      const response = await this.processMessage(userId, content);
      
      // Only proceed if GiGi is activated and response is not empty
      if (response && response.trim() !== '' && this.isActivated(content)) {
        return response;
      }
      
      return null; // No response needed
    } catch (error) {
      logger.error('Primary Gemini processing failed, attempting fallback:', error);
      
      try {
        // Attempt fallback processing
        return await this.processMessage(userId, content, true);
      } catch (fallbackError) {
        logger.error('Gemini fallback processing failed:', fallbackError);
        throw new APIError(
          'Both primary and fallback processing failed',
          500,
          'Gemini'
        );
      }
    }
  }

  /**
   * Generate image description for vision tasks
   * @param {string} imageUrl - URL of the image
   * @param {string} userId - User ID for rate limiting
   * @returns {Promise<string>} Image description
   */
  async generateImageDescription(imageUrl, userId) {
    try {
      // Check rate limit
      rateLimiter.checkLimit(userId, 'gemini_vision', {
        windowMs: 300000, // 5 minutes
        maxRequests: 3
      });

      const model = this.client.getModel('gemini-pro-vision');
      const result = await model.generateContent([
        'Describe this image in detail:',
        { inlineData: { data: imageUrl, mimeType: 'image/jpeg' } }
      ]);

      return result.response.text();
    } catch (error) {
      logger.error('Error generating image description:', error);
      throw new APIError(
        'Failed to generate image description',
        error.status || 500,
        'Gemini'
      );
    }
  }

  /**
   * Get model information
   * @returns {Object} Model information
   */
  getModelInfo() {
    return {
      name: config.ai.gemini.model,
      temperature: config.ai.gemini.temperature,
      activationName: config.ai.gemini.activationName
    };
  }
}

// Export singleton instance
module.exports = new GeminiService();
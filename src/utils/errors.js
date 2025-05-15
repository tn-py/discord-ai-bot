const logger = require('./logger');

/**
 * Base error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error class for API-related errors
 */
class APIError extends AppError {
  constructor(message, statusCode = 500, source = 'Unknown') {
    super(message, statusCode);
    this.source = source;
  }
}

/**
 * Error class for rate limiting errors
 */
class RateLimitError extends AppError {
  constructor(message, retryAfter = 60) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }
}

/**
 * Error class for validation errors
 */
class ValidationError extends AppError {
  constructor(message, fields = {}) {
    super(message, 400);
    this.fields = fields;
  }
}

/**
 * Error handler for Discord interactions
 */
const handleInteractionError = async (error, interaction) => {
  logger.logError(error, { 
    interactionId: interaction.id,
    userId: interaction.user.id,
    commandName: interaction.commandName
  });

  const errorMessages = {
    RateLimitError: `You're doing that too fast! Please wait ${error.retryAfter} seconds.`,
    ValidationError: 'Invalid input provided. Please check your command parameters.',
    APIError: `Service ${error.source} is temporarily unavailable. Please try again later.`,
    default: 'An unexpected error occurred. Please try again later.'
  };

  const content = {
    content: errorMessages[error.name] || errorMessages.default,
    ephemeral: true
  };

  if (interaction.deferred) {
    await interaction.editReply(content).catch(err => {
      logger.error('Failed to edit error reply:', err);
    });
  } else if (interaction.replied) {
    await interaction.followUp(content).catch(err => {
      logger.error('Failed to follow up with error:', err);
    });
  } else {
    await interaction.reply(content).catch(err => {
      logger.error('Failed to send error reply:', err);
    });
  }
};

/**
 * Error handler for regular messages
 */
const handleMessageError = async (error, message) => {
  logger.logError(error, {
    messageId: message.id,
    userId: message.author.id,
    channelId: message.channel.id
  });

  const errorMessages = {
    RateLimitError: `You're doing that too fast! Please wait ${error.retryAfter} seconds.`,
    APIError: `Service ${error.source} is temporarily unavailable. Please try again later.`,
    default: 'An unexpected error occurred. Please try again later.'
  };

  await message.reply({
    content: errorMessages[error.name] || errorMessages.default
  }).catch(err => {
    logger.error('Failed to send error message:', err);
  });
};

/**
 * Validate required environment variables
 */
const validateEnv = (requiredVars) => {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

module.exports = {
  AppError,
  APIError,
  RateLimitError,
  ValidationError,
  handleInteractionError,
  handleMessageError,
  validateEnv
};
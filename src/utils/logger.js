const winston = require('winston');
const path = require('path');

// Custom format that includes timestamp and log level
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

// Define log directory
const logDir = path.join(process.cwd(), 'logs');

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: customFormat,
  transports: [
    // Always log to console for Docker/Coolify visibility
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with importance level of 'info' or less to combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// Create error logging helper
logger.logError = (error, context = {}) => {
  const errorLog = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  };
  
  if (error.response) {
    errorLog.response = {
      status: error.response.status,
      data: error.response.data
    };
  }

  logger.error('Error occurred:', errorLog);
};

module.exports = logger;
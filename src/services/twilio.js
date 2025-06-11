const twilio = require('twilio');
const config =require('../config');
const logger = require('../utils/logger');

let client;

try {
  if (!config.twilio.accountSid || !config.twilio.authToken || !config.twilio.phoneNumber) {
    logger.warn('Twilio credentials not fully configured. SMS functionality will be disabled.');
    client = null; // Explicitly set client to null if not configured
  } else {
    client = twilio(config.twilio.accountSid, config.twilio.authToken);
    logger.info('Twilio client initialized successfully.');
  }
} catch (error) {
  logger.error('Error initializing Twilio client:', error);
  client = null; // Ensure client is null on error
}

/**
 * Sends a text message using the Twilio API.
 *
 * @param {string} to The recipient's phone number. Must be in E.164 format.
 * @param {string} body The content of the text message.
 * @returns {Promise<object>} A promise that resolves with the Twilio message object on success.
 * @throws {Error} If Twilio is not configured or if the message fails to send.
 */
async function sendTextMessage(to, body) {
  if (!client) {
    logger.error('Twilio client is not initialized. Cannot send SMS.');
    throw new Error('Twilio service is not configured. Please check your environment variables.');
  }

  if (!to || !body) {
    throw new Error('Recipient phone number (to) and message body are required.');
  }

  // Basic E.164 format validation (starts with +, followed by digits)
  // For more robust validation, consider using a library like libphonenumber-js
  if (!/^\+[1-9]\d{1,14}$/.test(to)) {
    logger.warn(`Invalid phone number format: ${to}. Attempting to send anyway.`);
    // Depending on requirements, you might want to throw an error here instead.
  }

  try {
    const message = await client.messages.create({
      body: body,
      from: config.twilio.phoneNumber,
      to: to,
    });
    logger.info(`SMS sent successfully to ${to}. Message SID: ${message.sid}`);
    return message;
  } catch (error) {
    logger.error(`Error sending SMS to ${to}:`, error);
    // Rethrow a more generic error or handle specific Twilio errors
    throw new Error(`Failed to send SMS via Twilio: ${error.message}`);
  }
}

module.exports = {
  sendTextMessage,
  // You can add a function here to check if Twilio is configured if needed elsewhere
  isConfigured: () => !!client
};

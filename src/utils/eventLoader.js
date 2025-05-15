const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Load and register Discord event handlers
 * @param {Client} client - Discord client
 * @returns {Promise<void>}
 */
async function loadEvents(client) {
  try {
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFiles = await fs.readdir(eventsPath);
    
    for (const file of eventFiles) {
      if (!file.endsWith('.js')) continue;

      try {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
          logger.debug(`Registered one-time event handler: ${event.name}`);
        } else {
          client.on(event.name, (...args) => event.execute(...args));
          logger.debug(`Registered event handler: ${event.name}`);
        }
      } catch (error) {
        logger.error(`Error loading event file ${file}:`, error);
      }
    }

    logger.info('Event handlers loaded successfully');
  } catch (error) {
    logger.error('Error loading events:', error);
    throw error;
  }
}

module.exports = { loadEvents };
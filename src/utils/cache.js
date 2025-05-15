const NodeCache = require('node-cache');
const logger = require('./logger');
const config = require('../config');

class Cache {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.cache.defaultTTL,
      checkperiod: config.cache.defaultTTL * 0.2, // Check for expired keys at 20% of TTL
      useClones: false // Don't clone objects on get/set for better performance
    });

    // Log cache statistics periodically
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        const stats = this.cache.getStats();
        logger.debug('Cache statistics:', stats);
      }, 300000); // Every 5 minutes
    }
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any|undefined} - Cached value or undefined if not found
   */
  get(key) {
    try {
      const value = this.cache.get(key);
      logger.debug(`Cache ${value ? 'hit' : 'miss'} for key: ${key}`);
      return value;
    } catch (error) {
      logger.error('Error retrieving from cache:', error);
      return undefined;
    }
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} [ttl] - Time to live in seconds
   * @returns {boolean} - True if successful
   */
  set(key, value, ttl = config.cache.defaultTTL) {
    try {
      const success = this.cache.set(key, value, ttl);
      if (success) {
        logger.debug(`Cached value for key: ${key}, TTL: ${ttl}s`);
      }
      return success;
    } catch (error) {
      logger.error('Error setting cache:', error);
      return false;
    }
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   * @returns {number} - Number of deleted entries
   */
  delete(key) {
    try {
      const deleted = this.cache.del(key);
      if (deleted > 0) {
        logger.debug(`Deleted cache key: ${key}`);
      }
      return deleted;
    } catch (error) {
      logger.error('Error deleting from cache:', error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Get multiple values from cache
   * @param {string[]} keys - Array of cache keys
   * @returns {Object} - Object with key-value pairs
   */
  mget(keys) {
    try {
      return this.cache.mget(keys);
    } catch (error) {
      logger.error('Error retrieving multiple keys from cache:', error);
      return {};
    }
  }

  /**
   * Set multiple values in cache
   * @param {Object} keyValuePairs - Object with key-value pairs
   * @param {number} [ttl] - Time to live in seconds
   * @returns {boolean} - True if successful
   */
  mset(keyValuePairs, ttl = config.cache.defaultTTL) {
    try {
      const success = this.cache.mset(
        Object.entries(keyValuePairs).map(([key, value]) => ({
          key,
          val: value,
          ttl
        }))
      );
      if (success) {
        logger.debug(`Cached multiple values, keys: ${Object.keys(keyValuePairs).join(', ')}`);
      }
      return success;
    } catch (error) {
      logger.error('Error setting multiple cache entries:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    try {
      this.cache.flushAll();
      logger.debug('Cache cleared');
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }
}

// Export singleton instance
module.exports = new Cache();
const logger = require('./logger');
const config = require('../config');
const { RateLimitError } = require('./errors');

class RateLimiter {
  constructor() {
    // Map to store rate limit data for each user
    // Key: userId_actionType, Value: array of timestamps
    this.limits = new Map();
    
    // Clean up old entries periodically
    setInterval(() => this.cleanup(), 300000); // Every 5 minutes
  }

  /**
   * Check if a user has exceeded their rate limit for an action
   * @param {string} userId - User ID
   * @param {string} actionType - Type of action (e.g., 'chat', 'imagine', 'weather')
   * @param {Object} options - Rate limit options
   * @returns {boolean} - True if within limit, false if exceeded
   * @throws {RateLimitError} - If rate limit is exceeded
   */
  checkLimit(userId, actionType, options = {}) {
    const {
      windowMs = config.rateLimiting.windowMs,
      maxRequests = config.rateLimiting.maxRequests
    } = options;

    const key = `${userId}_${actionType}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing timestamps for this user and action
    let timestamps = this.limits.get(key) || [];

    // Remove timestamps outside the current window
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    // Check if user has exceeded the limit
    if (timestamps.length >= maxRequests) {
      const oldestTimestamp = timestamps[0];
      const resetTime = oldestTimestamp + windowMs - now;
      const resetSeconds = Math.ceil(resetTime / 1000);

      logger.warn(`Rate limit exceeded for user ${userId} on action ${actionType}`);
      throw new RateLimitError(
        `Rate limit exceeded for ${actionType}. Please try again later.`,
        resetSeconds
      );
    }

    // Add current timestamp and update the map
    timestamps.push(now);
    this.limits.set(key, timestamps);

    return true;
  }

  /**
   * Get remaining requests for a user and action
   * @param {string} userId - User ID
   * @param {string} actionType - Type of action
   * @param {Object} options - Rate limit options
   * @returns {Object} - Remaining requests and reset time
   */
  getRemainingRequests(userId, actionType, options = {}) {
    const {
      windowMs = config.rateLimiting.windowMs,
      maxRequests = config.rateLimiting.maxRequests
    } = options;

    const key = `${userId}_${actionType}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing timestamps for this user and action
    let timestamps = this.limits.get(key) || [];
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    const remaining = maxRequests - timestamps.length;
    const resetTime = timestamps.length > 0 
      ? timestamps[0] + windowMs - now 
      : 0;

    return {
      remaining,
      resetTime: Math.ceil(resetTime / 1000)
    };
  }

  /**
   * Clean up old rate limit entries
   */
  cleanup() {
    const now = Date.now();
    const maxWindow = config.rateLimiting.windowMs;

    for (const [key, timestamps] of this.limits.entries()) {
      // Remove all timestamps older than the maximum window
      const validTimestamps = timestamps.filter(
        timestamp => now - timestamp < maxWindow
      );

      if (validTimestamps.length === 0) {
        // If no valid timestamps remain, remove the entry
        this.limits.delete(key);
      } else {
        // Update with only valid timestamps
        this.limits.set(key, validTimestamps);
      }
    }

    logger.debug('Rate limiter cleanup completed');
  }

  /**
   * Reset rate limit for a user and action
   * @param {string} userId - User ID
   * @param {string} actionType - Type of action
   */
  resetLimit(userId, actionType) {
    const key = `${userId}_${actionType}`;
    this.limits.delete(key);
    logger.debug(`Rate limit reset for user ${userId} on action ${actionType}`);
  }

  /**
   * Get current rate limit status
   * @returns {Object} - Current rate limit statistics
   */
  getStatus() {
    return {
      activeUsers: this.limits.size,
      limits: Array.from(this.limits.entries()).map(([key, timestamps]) => ({
        key,
        requestCount: timestamps.length,
        oldestRequest: new Date(Math.min(...timestamps)).toISOString()
      }))
    };
  }
}

// Export singleton instance
module.exports = new RateLimiter();
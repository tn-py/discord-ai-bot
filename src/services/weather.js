const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const cache = require('../utils/cache');
const rateLimiter = require('../utils/rateLimiter');
const { APIError, ValidationError } = require('../utils/errors');

class WeatherService {
  constructor() {
    this.geoClient = axios.create({
      baseURL: config.weather.geoEndpoint,
      params: {
        appid: config.weather.apiKey
      }
    });

    this.weatherClient = axios.create({
      baseURL: config.weather.weatherEndpoint
    });
  }

  /**
   * Get coordinates for a location
   * @param {string} location - Location name or zip code
   * @returns {Promise<Object>} Location coordinates
   */
  async getCoordinates(location) {
    try {
      const cacheKey = `geo:${location}`;
      
      // Check cache
      const cachedCoords = cache.get(cacheKey);
      if (cachedCoords) {
        logger.debug('Returning cached coordinates for location:', location);
        return cachedCoords;
      }

      const response = await this.geoClient.get('', {
        params: {
          q: location,
          limit: 1
        }
      });

      if (!response.data || response.data.length === 0) {
        throw new ValidationError('Location not found');
      }

      const { lat, lon, name: locationName } = response.data[0];
      const coordinates = { latitude: lat, longitude: lon, locationName };

      // Cache coordinates for 24 hours
      cache.set(cacheKey, coordinates, 86400);

      return coordinates;
    } catch (error) {
      logger.error('Error getting coordinates:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new APIError(
        'Failed to get location coordinates',
        error.response?.status || 500,
        'OpenWeatherMap'
      );
    }
  }

  /**
   * Get weather data for coordinates
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {Promise<Object>} Weather data
   */
  async getWeatherData(latitude, longitude) {
    try {
      const cacheKey = `weather:${latitude},${longitude}`;
      
      // Check cache
      const cachedWeather = cache.get(cacheKey);
      if (cachedWeather) {
        logger.debug('Returning cached weather data for coordinates:', { latitude, longitude });
        return cachedWeather;
      }

      const response = await this.weatherClient.get('', {
        params: {
          latitude,
          longitude,
          hourly: 'temperature_2m,precipitation_probability,weathercode',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
          timezone: 'auto'
        }
      });

      const weatherData = this.formatWeatherData(response.data);

      // Cache weather data for 30 minutes
      cache.set(cacheKey, weatherData, config.weather.cacheTimeout);

      return weatherData;
    } catch (error) {
      logger.error('Error getting weather data:', error);
      throw new APIError(
        'Failed to get weather data',
        error.response?.status || 500,
        'OpenMeteo'
      );
    }
  }

  /**
   * Format weather data response
   * @param {Object} data - Raw weather data
   * @returns {Object} Formatted weather data
   */
  formatWeatherData(data) {
    const current = {
      temperature: data.hourly.temperature_2m[0],
      precipitation: data.hourly.precipitation_probability[0],
      weatherCode: data.hourly.weathercode[0]
    };

    const hourly = {
      times: data.hourly.time.slice(0, 24),
      temperatures: data.hourly.temperature_2m.slice(0, 24),
      precipitation: data.hourly.precipitation_probability.slice(0, 24)
    };

    const daily = {
      maxTemperatures: data.daily.temperature_2m_max,
      minTemperatures: data.daily.temperature_2m_min,
      precipitation: data.daily.precipitation_probability_max
    };

    return {
      current,
      hourly,
      daily,
      units: {
        temperature: data.hourly_units.temperature_2m,
        precipitation: '%'
      }
    };
  }

  /**
   * Get weather description based on weather code
   * @param {number} code - Weather code
   * @returns {string} Weather description
   */
  getWeatherDescription(code) {
    const descriptions = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow fall',
      73: 'Moderate snow fall',
      75: 'Heavy snow fall',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail'
    };
    return descriptions[code] || 'Unknown weather condition';
  }

  /**
   * Get complete weather forecast for a location
   * @param {string} location - Location name or zip code
   * @param {string} userId - User ID for rate limiting
   * @returns {Promise<Object>} Complete weather forecast
   */
  async getWeatherForecast(location, userId) {
    try {
      // Check rate limit
      rateLimiter.checkLimit(userId, 'weather', {
        windowMs: 60000, // 1 minute
        maxRequests: 5
      });

      // Get coordinates
      const coordinates = await this.getCoordinates(location);
      
      // Get weather data
      const weatherData = await this.getWeatherData(
        coordinates.latitude,
        coordinates.longitude
      );

      return {
        location: coordinates.locationName,
        ...weatherData,
        description: this.getWeatherDescription(weatherData.current.weatherCode)
      };
    } catch (error) {
      logger.error('Error getting weather forecast:', error);
      throw error; // Re-throw since error is already handled
    }
  }

  /**
   * Format weather message for Discord
   * @param {Object} forecast - Weather forecast data
   * @returns {string} Formatted message
   */
  formatWeatherMessage(forecast) {
    const current = forecast.current;
    const daily = forecast.daily;

    return [
      `**Weather in ${forecast.location}**`,
      `🌡️ Current temperature: ${current.temperature}${forecast.units.temperature}`,
      `🌧️ Precipitation chance: ${current.precipitation}%`,
      `🌥️ Conditions: ${forecast.description}`,
      '',
      '**Today\'s Forecast**',
      `High: ${daily.maxTemperatures[0]}${forecast.units.temperature}`,
      `Low: ${daily.minTemperatures[0]}${forecast.units.temperature}`,
      `Precipitation chance: ${daily.precipitation[0]}%`
    ].join('\n');
  }
}

// Export singleton instance
module.exports = new WeatherService();
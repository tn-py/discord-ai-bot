const { GatewayIntentBits } = require('discord.js');

const config = {
  discord: {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    guildId: process.env.DISCORD_GUILD_ID
  },
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      assistantId: process.env.OPENAI_ASSISTANT_ID,
      model: 'gpt-3.5-turbo',
      maxTokens: 1024,
      timeout: 30000 // 30 seconds
    }
  },
  weather: {
    apiKey: process.env.OPENWEATHER_API_KEY,
    cacheTimeout: 1800, // 30 minutes
    geoEndpoint: 'http://api.openweathermap.org/geo/1.0/direct',
    weatherEndpoint: 'https://api.open-meteo.com/v1/forecast'
  },
  rateLimiting: {
    windowMs: 60000, // 1 minute
    maxRequests: 5
  },
  cache: {
    defaultTTL: 3600 // 1 hour
  }
};

module.exports = config;
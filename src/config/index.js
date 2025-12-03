const { GatewayIntentBits } = require('discord.js');

const config = {
  discord: {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates
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
  movie: {
    apiKey: process.env.OMDB_API_KEY,
    baseUrl: 'http://www.omdbapi.com/'
  },
  vapi: {
    apiKey: process.env.VAPI_API_KEY,
    assistantId: process.env.VAPI_ASSISTANT_ID,
    baseUrl: 'https://api.vapi.ai'
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
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
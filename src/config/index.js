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
    },
    gemini: {
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
      model: 'gemini-2.5-flash-preview-04-17',
      temperature: 0.7,
      initialPrompt: "You are an AI assistant named GiGi. Only respond if someone specifically calls you by your name 'GiGi'. Otherwise, remain silent and do not generate any response. If someone uses your name, acknowledge them and provide helpful responses.",
      fallbackPrompt: "You are a helpful assistant named GiGi."
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
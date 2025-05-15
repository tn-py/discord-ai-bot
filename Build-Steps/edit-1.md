# Discord Bot Refactoring Plan

## 1. Project Structure
```
src/
  ├── commands/           # Command handlers
  │   ├── imagine.js
  │   ├── chat.js
  │   └── weather.js
  ├── services/          # Business logic
  │   ├── openai.js
  │   ├── gemini.js
  │   └── weather.js
  ├── config/           # Configuration
  │   ├── index.js
  │   └── constants.js
  ├── utils/            # Helper functions
  │   ├── logger.js
  │   ├── cache.js
  │   └── rateLimiter.js
  ├── events/           # Discord event handlers
  │   ├── ready.js
  │   ├── interactionCreate.js
  │   └── messageCreate.js
  └── app.js           # Main application file

tests/                 # Test files
  ├── unit/
  ├── integration/
  └── e2e/
```

## 2. Performance Optimizations

### 2.1 Caching Implementation
```javascript
// src/utils/cache.js
const NodeCache = require('node-cache');

class Cache {
  constructor(ttlSeconds = 3600) {
    this.cache = new NodeCache({ 
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 0.2
    });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    return this.cache.set(key, value);
  }
}

module.exports = new Cache();
```

### 2.2 Rate Limiting
```javascript
// src/utils/rateLimiter.js
const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs = 60000, max = 5) => {
  return new Map();
};

const rateLimiter = createLimiter();

const checkRateLimit = (userId) => {
  const now = Date.now();
  const userRequests = rateLimiter.get(userId) || [];
  const windowMs = 60000; // 1 minute

  // Clean old requests
  const recentRequests = userRequests.filter(
    timestamp => now - timestamp < windowMs
  );

  if (recentRequests.length >= 5) {
    return false;
  }

  recentRequests.push(now);
  rateLimiter.set(userId, recentRequests);
  return true;
};

module.exports = { checkRateLimit };
```

## 3. Error Handling & Reliability

### 3.1 Custom Error Classes
```javascript
// src/utils/errors.js
class APIError extends Error {
  constructor(message, statusCode, source) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.source = source;
  }
}

class RateLimitError extends Error {
  constructor(message, retryAfter) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

module.exports = {
  APIError,
  RateLimitError
};
```

### 3.2 Error Boundaries
```javascript
// src/utils/errorBoundary.js
const handleError = async (error, interaction) => {
  console.error('Error:', error);

  if (error instanceof RateLimitError) {
    return interaction.reply({
      content: `You're doing that too fast! Please wait ${error.retryAfter} seconds.`,
      ephemeral: true
    });
  }

  if (error instanceof APIError) {
    return interaction.reply({
      content: 'Service temporarily unavailable. Please try again later.',
      ephemeral: true
    });
  }

  return interaction.reply({
    content: 'An unexpected error occurred. Please try again later.',
    ephemeral: true
  });
};

module.exports = { handleError };
```

## 4. Modern JavaScript Features

### 4.1 Configuration Management
```javascript
// src/config/index.js
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
      maxTokens: 1024
    },
    gemini: {
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
      model: 'gemini-2.5-flash-preview-04-17',
      temperature: 0.7
    }
  },
  weather: {
    apiKey: process.env.OPENWEATHER_API_KEY,
    cacheTimeout: 1800 // 30 minutes
  }
};

module.exports = config;
```

### 4.2 Command Handler Example
```javascript
// src/commands/weather.js
const { SlashCommandBuilder } = require('discord.js');
const { getWeather } = require('../services/weather');
const { handleError } = require('../utils/errorBoundary');
const cache = require('../utils/cache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get the weather forecast')
    .addStringOption(option => 
      option
        .setName('location')
        .setDescription('City name or zip code')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      
      const location = interaction.options.getString('location');
      const cacheKey = `weather:${location}`;
      
      // Check cache first
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        return interaction.editReply(cachedData);
      }

      const weather = await getWeather(location);
      const response = `The current temperature in ${location} is ${weather.temperature}°C.`;
      
      // Cache the response
      cache.set(cacheKey, response);
      
      await interaction.editReply(response);
    } catch (error) {
      await handleError(error, interaction);
    }
  }
};
```

## 5. Testing Strategy

### 5.1 Unit Tests Example
```javascript
// tests/unit/services/weather.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const { getWeather } = require('../../../src/services/weather');
const axios = require('axios');

describe('Weather Service', () => {
  let axiosStub;

  beforeEach(() => {
    axiosStub = sinon.stub(axios, 'get');
  });

  afterEach(() => {
    axiosStub.restore();
  });

  it('should return weather data for valid location', async () => {
    // Arrange
    const mockGeoResponse = {
      data: [{ lat: 40.7128, lon: -74.0060 }]
    };
    
    const mockWeatherResponse = {
      data: {
        hourly: {
          temperature_2m: [20]
        }
      }
    };

    axiosStub.onFirstCall().resolves(mockGeoResponse);
    axiosStub.onSecondCall().resolves(mockWeatherResponse);

    // Act
    const result = await getWeather('New York');

    // Assert
    expect(result).to.have.property('temperature', 20);
  });
});
```

## 6. Monitoring & Logging

### 6.1 Logger Implementation
```javascript
// src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

## Implementation Steps

1. Install additional dependencies:
```bash
npm install node-cache express-rate-limit winston chai sinon
```

2. Create the directory structure
3. Move existing code into appropriate modules
4. Implement new features (caching, rate limiting, error handling)
5. Add tests
6. Update documentation

## Benefits

- **Performance**: Caching and rate limiting reduce API calls and improve response times
- **Reliability**: Proper error handling and monitoring catch issues early
- **Maintainability**: Modular structure makes code easier to understand and modify
- **Scalability**: Separated concerns allow for easier feature additions
- **Testing**: Structured for comprehensive test coverage
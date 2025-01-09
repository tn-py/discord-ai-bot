const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
require('dotenv').config();

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Google Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  const commands = [
    new SlashCommandBuilder().setName('imagine').setDescription('Generate an image using AI').addStringOption(option => option.setName('prompt').setDescription('The prompt for the image').setRequired(true)),
    new SlashCommandBuilder().setName('guaro-chat').setDescription('Start a conversation with the AI'),
    new SlashCommandBuilder().setName('weather').setDescription('Get the weather forecast').addStringOption(option => option.setName('location').setDescription('City name or zip code').setRequired(true))
  ];

  // Register commands for a specific guild (server)
  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
  if (guild) {
    await guild.commands.set(commands);
    console.log(`Slash commands registered for guild: ${guild.name}`);
  } else {
    console.error('Guild not found. Check your DISCORD_GUILD_ID.');
  }
});

const conversations = new Map();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'imagine') {
    const prompt = interaction.options.getString('prompt');
    await interaction.deferReply();

    try {
      // Generate image with OpenAI
      const openaiResponse = await openai.images.generate({
        prompt: prompt,
        n: 1,
        size: '512x512',
      });

      if (openaiResponse.data && openaiResponse.data.length > 0) {
        const openaiImageUrl = openaiResponse.data[0].url;
        await interaction.editReply({ content: `OpenAI: ${openaiImageUrl}` });
      } else {
        throw new Error('OpenAI did not return any images.');
      }
    } catch (openaiError) {
      console.error('Error with OpenAI:', openaiError);
      try {
        // Fallback to Google Gemini if OpenAI fails
        const model = genAI.getModel('gemini-pro-vision');
        const geminiResponse = await model.generateContent(prompt);
        const geminiImageUrl = geminiResponse.response.candidates[0].content.parts[0].text;
        await interaction.editReply({ content: `Gemini: ${geminiImageUrl}` });
      } catch (geminiError) {
        console.error('Error with Google Gemini:', geminiError);
        await interaction.editReply('Error generating image from both OpenAI and Google Gemini.');
      }
    }
  }

  if (interaction.commandName === 'guaro-chat') {
    await interaction.reply('Starting a conversation. Ask me anything!');
    conversations.set(interaction.user.id, []);
  }

  if (interaction.commandName === 'weather') {
    const location = interaction.options.getString('location');
    await interaction.deferReply();

    try {
      // Convert location to latitude and longitude using OpenWeather API
      console.log(`Fetching weather data for location: ${location}`);
      const geoResponse = await axios.get('http://api.openweathermap.org/geo/1.0/direct', {
        params: {
          q: location,
          limit: 1,
          appid: process.env.OPENWEATHER_API_KEY
        }
      });

      console.log('Geo API response:', geoResponse.data);

      if (geoResponse.data.length === 0) {
        throw new Error('Location not found');
      }

      const { lat: latitude, lon: longitude } = geoResponse.data[0];
      console.log(`Coordinates: latitude=${latitude}, longitude=${longitude}`);

      // Fetch weather data from Open-Meteo
      const weatherResponse = await axios.get(`https://api.open-meteo.com/v1/forecast`, {
        params: {
          latitude: latitude,
          longitude: longitude,
          hourly: 'temperature_2m',
          timezone: 'auto'
        }
      });

      console.log('Weather API response:', weatherResponse.data);

      const temperature = weatherResponse.data.hourly.temperature_2m[0];
      await interaction.editReply(`The current temperature in ${location} is ${temperature}°C.`);
    } catch (error) {
      console.error('Error fetching weather data:', error);
      await interaction.editReply('Error fetching weather data. Please try again later.');
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const conversationHistory = conversations.get(message.author.id);

  if (conversationHistory) {
    conversationHistory.push({ role: 'user', content: message.content });

    try {
      const openaiChatResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: conversationHistory,
      });

      const reply = openaiChatResponse.choices[0].message.content;
      conversationHistory.push({ role: 'assistant', content: reply });
      message.reply(reply);
    } catch (error) {
      console.error(error);
      message.reply('Error processing your request.');
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);

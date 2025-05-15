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

// Create a map to track active conversations with GiGi
const activeGiGiConversations = new Map();

// Configuration
const config = {
  openaiAssistantId: process.env.OPENAI_ASSISTANT_ID, // Add this to your .env file
  geminiModel: 'gemini-2.5-flash-preview-04-17',
  activationName: 'GiGi',
  geminiInitialSystemPrompt: "You are an AI assistant named GiGi. Only respond if someone specifically calls you by your name 'GiGi'. Otherwise, remain silent and do not generate any response. If someone uses your name, acknowledge them and provide helpful responses.",
  geminiFallbackSystemPrompt: "You are a helpful assistant named GiGi."
};

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  const commands = [
    new SlashCommandBuilder().setName('imagine').setDescription('Generate an image using AI').addStringOption(option => option.setName('prompt').setDescription('The prompt for the image').setRequired(true)),
    new SlashCommandBuilder().setName('chat').setDescription('Start a conversation with the AI'),
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

  if (interaction.commandName === 'chat') {
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

// Helper function to check if a message activates GiGi
function isGiGiActivated(message) {
  const content = message.content.toLowerCase();
  return content.includes(config.activationName.toLowerCase());
}

// OpenAI Assistant thread management
async function getOrCreateAssistantThread(userId) {
  try {
    let threadData = activeGiGiConversations.get(userId);
    
    if (!threadData) {
      // Create a new thread
      const thread = await openai.beta.threads.create();
      threadData = {
        threadId: thread.id,
        messages: []
      };
      activeGiGiConversations.set(userId, threadData);
    }
    
    return threadData;
  } catch (error) {
    console.error('Error creating or retrieving OpenAI thread:', error);
    throw error;
  }
}

// Process a message with OpenAI Assistant
async function processWithOpenAIAssistant(message, userMessage) {
  try {
    const { threadId } = await getOrCreateAssistantThread(message.author.id);
    
    // Add the user message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: userMessage
    });
    
    // Run the assistant on the thread
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: config.openaiAssistantId
    });
    
    // Poll for the run completion
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    // Wait for run to complete (with timeout)
    const startTime = Date.now();
    const timeoutMs = 30000; // 30 seconds timeout
    
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before checking again
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }
    
    if (runStatus.status !== 'completed') {
      throw new Error(`Assistant run did not complete in time. Status: ${runStatus.status}`);
    }
    
    // Get the assistant's messages
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantMessages = messages.data.filter(msg => msg.role === 'assistant');
    
    if (assistantMessages.length > 0) {
      // Get the most recent assistant message
      const latestMessage = assistantMessages[0];
      return latestMessage.content[0].text.value;
    } else {
      throw new Error('No assistant messages found');
    }
  } catch (error) {
    console.error('Error processing with OpenAI Assistant:', error);
    throw error;
  }
}

// Process a message with Gemini
async function processWithGemini(message, userMessage, isFallback = false) {
  try {
    const model = genAI.getModel(config.geminiModel);
    const systemPrompt = isFallback 
      ? config.geminiFallbackSystemPrompt 
      : config.geminiInitialSystemPrompt;
    
    // Generate content with Gemini
    const generationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    };
    
    const chat = model.startChat({
      generationConfig,
      history: [],
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    });
    
    // Add system prompt
    await chat.sendMessage(systemPrompt);
    
    // Send user message and get response
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (error) {
    console.error('Error processing with Gemini:', error);
    throw error;
  }
}

// Main message handler
client.on('messageCreate', async message => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  try {
    // Handle existing chat command conversations (from your original code)
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
      return; // Don't continue with GiGi processing
    }
    
    // Process all messages through Gemini with the initial system prompt
    const geminiResponse = await processWithGemini(message, message.content);
    
    // If Gemini decides to respond (only if GiGi is mentioned)
    if (geminiResponse && geminiResponse.trim() !== '' && isGiGiActivated(message)) {
      console.log("GiGi activated! Trying OpenAI Assistant...");
      
      // Try to use OpenAI Assistant
      try {
        if (process.env.OPENAI_API_KEY && config.openaiAssistantId) {
          const assistantResponse = await processWithOpenAIAssistant(message, message.content);
          await message.reply(assistantResponse);
        } else {
          throw new Error("OpenAI API key or Assistant ID not configured");
        }
      } catch (openaiError) {
        console.error("Failed to use OpenAI Assistant, falling back to Gemini:", openaiError);
        
        // Fallback to Gemini with the fallback system prompt
        try {
          const fallbackResponse = await processWithGemini(message, message.content, true);
          await message.reply(fallbackResponse);
        } catch (geminiError) {
          console.error("Failed to use Gemini fallback:", geminiError);
          await message.reply("I'm having trouble connecting to my resources right now. Please try again later.");
        }
      }
    }
  } catch (error) {
    console.error('Error in message processing:', error);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
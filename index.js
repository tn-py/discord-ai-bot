// index.js
const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Discord Client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Google Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Register slash commands
  const commands = [
    new SlashCommandBuilder().setName('imagine').setDescription('Generate an image using AI').addStringOption(option => option.setName('prompt').setDescription('The prompt for the image').setRequired(true)),
    new SlashCommandBuilder().setName('guaro-chat').setDescription('Start a conversation with the AI'),
  ];

  client.guilds.cache.get(process.env.DISCORD_GUILD_ID)?.commands.set(commands);
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
      const openaiImageUrl = openaiResponse.data[0].url;

      // Generate image with Gemini
      const model = genAI.getModel('gemini-pro-vision');
      const geminiResponse = await model.generateContent(prompt);
      const geminiImageUrl = geminiResponse.response.candidates[0].content.parts[0].text; // This might need adjustment

      await interaction.editReply({
        content: `OpenAI: ${openaiImageUrl}\nGemini: ${geminiImageUrl}`,
      });
    } catch (error) {
      console.error(error);
      await interaction.editReply('Error generating image.');
    }
  }

  if (interaction.commandName === 'guaro-chat') {
    await interaction.reply('Starting a conversation. Ask me anything!');
    conversations.set(interaction.user.id, []);
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

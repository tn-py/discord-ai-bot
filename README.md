# GiGi Discord AI Assistant

This bot integrates with the Discord API and provides the following functionalities:

1. **Always-on AI Assistant "GiGi"** that responds when called by name
2. **Image Generation** using OpenAI
3. **AI Chatbot** powered by OpenAI
4. **Weather Forecast** using OpenWeather and Open-Meteo APIs

---

## **Prerequisites**

- Docker
- Docker Compose
- Discord Bot Token
- OpenAI API Key
- OpenAI Assistant ID
- OpenWeather API Key

Ensure you have a `.env` file in the root directory with the following variables:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_guild_id
OPENAI_API_KEY=your_openai_api_key
OPENAI_ASSISTANT_ID=your_openai_assistant_id
OPENWEATHER_API_KEY=your_openweather_api_key
```

---

## **Features**

### **GiGi AI Assistant**

GiGi is an always-listening AI assistant that responds when users mention its name:

- Processes all chat messages through OpenAI
- Activates when users mention "GiGi" in any message
- Powered by OpenAI Assistant
- No commands needed - just chat naturally and mention "GiGi"

Examples:
- "Hey GiGi, what's the weather like today?"
- "I wonder if GiGi knows the answer to this question?"
- "GiGi can you help me with my homework?"

### **Other Bot Commands**

The bot also provides traditional slash commands for specific functions:

| Command      | Description                          |
|--------------|--------------------------------------|
| /imagine     | Generate an image using AI           |
| /chat        | Start a conversation with the AI     |
| /weather     | Get the weather forecast for a location |

---

## **How to Run the Bot with Docker**

### **1. Clone the Repository**

```bash
git clone https://github.com/yourusername/discord-ai-bot.git
cd discord-ai-bot
```

### **2. Build and Run the Docker Container**

Make sure your `docker-compose.yml` file looks like this:

```yaml
services:
  discord-bot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: discord-ai-bot
    ports:
      - "3005:3005"
    env_file:
      - .env
    restart: unless-stopped
```

Then run the following command to build and start the container:

```bash
docker-compose up --build
```

The bot will log in to your Discord server, register slash commands, and begin listening for messages that mention GiGi.

---

## **Testing Locally**

If you want to test the bot locally without Docker, you can run:

```bash
npm install
npm run start
```

Ensure your `.env` file is in place with the correct credentials.

---

## **OpenAI Assistant Setup**

To use GiGi with an OpenAI Assistant:

1. Create an Assistant at [OpenAI](https://platform.openai.com/assistants)
2. Get your Assistant ID from the Assistant details page
3. Add the Assistant ID to your `.env` file as `OPENAI_ASSISTANT_ID`

---

## **Troubleshooting**

### **Common Errors**

- **401 Unauthorized Error**: Make sure your API keys in the `.env` file are correct.
- **Bot Not Responding**: Ensure the bot is added to your Discord server and has the required permissions.
- **GiGi Not Responding**: Check that your `OPENAI_ASSISTANT_ID` is correct and that you've mentioned "GiGi" in your message.

### **Check Logs**

To check the logs of the Docker container:

```bash
docker logs discord-ai-bot
```

---

## **License**

This project is licensed under the MIT License. Feel free to use and modify the code.

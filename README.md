# Discord AI Bot

This bot integrates with the Discord API and provides three main functionalities:

1. **Image Generation** using OpenAI and Google Generative AI.
2. **AI Chatbot** powered by OpenAI.
3. **Weather Forecast** using OpenWeather and Open-Meteo APIs.

---

## **Prerequisites**

- Docker
- Docker Compose
- Discord Bot Token
- OpenAI API Key
- Google Generative AI API Key
- OpenWeather API Key

Ensure you have a `.env` file in the root directory with the following variables:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_guild_id
OPENAI_API_KEY=your_openai_api_key
GOOGLE_GEMINI_API_KEY=your_google_gemini_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
```

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

The bot will log in to your Discord server and register slash commands.

---

## **Slash Commands**

| Command      | Description                          |
|--------------|--------------------------------------|
| /imagine     | Generate an image using AI           |
| /guaro-chat  | Start a conversation with the AI     |
| /weather     | Get the weather forecast for a location |

---

## **Testing Locally**

If you want to test the bot locally without Docker, you can run:

```bash
npm install
npm run start
```

Ensure your `.env` file is in place with the correct credentials.

---

## **Troubleshooting**

### **Common Errors**

- **401 Unauthorized Error**: Make sure your API keys in the `.env` file are correct.
- **Bot Not Responding**: Ensure the bot is added to your Discord server and has the required permissions.

### **Check Logs**

To check the logs of the Docker container:

```bash
docker logs discord-ai-bot
```

---

## **License**

This project is licensed under the MIT License. Feel free to use and modify the code.


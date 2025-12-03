# GiGi Discord AI Assistant

This bot integrates with the Discord API and provides the following functionalities:

1. **Always-on AI Assistant "GiGi"** that responds when called by name
2. **Image Generation** using OpenAI
3. **AI Chatbot** powered by OpenAI
4. **Weather Forecast** using OpenWeather and Open-Meteo APIs
5. **Movie Information** using OMDb API
6. **Voice Integration** with VAPI when joining "GiGi" channel

---

## **Prerequisites**

- Docker
- Docker Compose
- Discord Bot Token
- OpenAI API Key
- OpenAI Assistant ID
- OpenWeather API Key
- OMDb API Key
- VAPI API Key
- VAPI Assistant ID

Ensure you have a `.env` file in the root directory with the following variables:

```env
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_guild_id
OPENAI_API_KEY=your_openai_api_key
OPENAI_ASSISTANT_ID=your_openai_assistant_id
OPENWEATHER_API_KEY=your_openweather_api_key
OMDB_API_KEY=your_omdb_api_key
VAPI_API_KEY=your_vapi_api_key
VAPI_ASSISTANT_ID=your_vapi_assistant_id
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

### **Voice Integration**

The bot will automatically join any voice channel named **"GiGi"** (case-sensitive) when a user joins it. It will then connect to the configured VAPI assistant.

### **Other Bot Commands**

The bot also provides traditional slash commands for specific functions:

| Command      | Description                          |
|--------------|--------------------------------------|
| /imagine     | Generate an image using AI           |
| /chat        | Start a conversation with the AI     |
| /weather     | Get the weather forecast for a location |
| /f1 check     | Get the most recent F1 race stats |
| /movie        | Get information about a movie        |

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

## **Command Synchronization**

The bot provides two ways to sync slash commands:

```bash
# Register commands for a specific server (guild)
npm run sync-commands

# Register commands globally across all servers
npm run sync-commands:global
```

Note: Global commands can take up to 1 hour to propagate across all servers due to Discord's caching. For development and testing, use `sync-commands` for immediate updates in your test server. Once your commands are stable, use `sync-commands:global` to deploy them across all servers where your bot is present.

---

## **Updating Commands**

If you've added new commands (like `/movie`) and they aren't appearing in Discord after deployment:

1. **Restart the Discord Client**: Sometimes Discord needs a reload (Ctrl+R) to see new commands.
2. **Rebuild the Container**: If using Docker, ensure you rebuilt the image to include the new code:
   ```bash
   docker-compose up --build -d
   ```
3. **Manual Sync**: You can force a command sync by running the sync script:
   
   **Locally:**
   ```bash
   npm run sync-commands
   ```

   **Inside Docker:**
   ```bash
   docker exec -it discord-ai-bot npm run sync-commands
   ```

   *Note: This syncs commands to the guild specified in `DISCORD_GUILD_ID`. For global commands, use `sync-commands:global`.*

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

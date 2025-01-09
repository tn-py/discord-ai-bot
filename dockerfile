# Use Node.js LTS version as base
FROM node:18

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files first for better Docker caching
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy the rest of the app files
COPY . .

# Expose the port your bot will run on (Coolify needs this)
EXPOSE 3005

# Start the bot
CMD ["npm", "start"]

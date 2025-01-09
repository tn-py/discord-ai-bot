# Use Node.js LTS as the base image
FROM node:18

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port for the bot
EXPOSE 3005

# Start the bot
CMD ["npm", "start"]

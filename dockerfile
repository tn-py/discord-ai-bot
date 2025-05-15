# Use Node.js LTS as the base image
FROM node:18-alpine

# Add package for healthcheck
RUN apk add --no-cache curl

# Create app directory
WORKDIR /usr/src/app

# Set Node.js to production mode
ENV NODE_ENV=production

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Create logs directory and set permissions
RUN mkdir -p logs && chown -R node:node logs

# Create healthcheck script
COPY healthcheck.js .
RUN chmod +x healthcheck.js

# Switch to non-root user
USER node

# Expose the port for the bot
EXPOSE ${PORT:-3005}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node healthcheck.js

# Start the bot
CMD ["npm", "start"]

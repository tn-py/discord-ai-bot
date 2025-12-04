const axios = require('axios');
const WebSocket = require('ws');
const EventEmitter = require('events');
const config = require('../config');
const logger = require('../utils/logger');

class VapiService extends EventEmitter {
    constructor() {
        super();
        this.client = axios.create({
            baseURL: config.vapi.baseUrl,
            headers: {
                'Authorization': `Bearer ${config.vapi.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        this.ws = null;
        this.sessionId = null;
    }

    /**
     * Start a call with the assistant
     * @param {string} channelId - Discord voice channel ID
     * @returns {Promise<Object>} Call session data
     */
    async startCall(channelId) {
        try {
            if (!config.vapi.apiKey || !config.vapi.assistantId) {
                logger.warn('VAPI credentials not configured');
                return null;
            }

            logger.info(`Starting VAPI session for channel: ${channelId}`);

            // Initiate the web call
            const response = await this.client.post('/call/web', {
                assistantId: config.vapi.assistantId,
            });

            const { webCallUrl, call } = response.data;
            this.sessionId = call.id;

            logger.info(`VAPI Web Call URL obtained. Session ID: ${this.sessionId}`);

            // Connect to WebSocket
            this.ws = new WebSocket(webCallUrl);

            this.ws.on('open', () => {
                logger.info('Connected to VAPI WebSocket');
                this.emit('open');
            });

            this.ws.on('message', (data, isBinary) => {
                if (isBinary) {
                    // Received binary audio data (PCM)
                    this.emit('audio', data);
                } else {
                    try {
                        const message = JSON.parse(data.toString());
                        // logger.debug('VAPI Message:', message);

                        if (message.type === 'audio') {
                            // Handle if audio comes as JSON (unlikely for raw stream but possible)
                        }
                    } catch (error) {
                        logger.error('Error parsing VAPI message:', error);
                    }
                }
            });

            this.ws.on('close', () => {
                logger.info('VAPI WebSocket closed');
                this.emit('close');
                this.ws = null;
            });

            this.ws.on('error', (error) => {
                logger.error('VAPI WebSocket error:', error);
                this.emit('error', error);
            });

            return { sessionId: this.sessionId };

        } catch (error) {
            logger.error('Error starting VAPI call:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    /**
     * Send audio data to VAPI
     * @param {Buffer} buffer - PCM audio buffer
     */
    sendAudio(buffer) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(buffer);
        }
    }

    /**
     * Stop the call
     */
    async stopCall() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        logger.info(`Stopped VAPI session: ${this.sessionId}`);
    }
}

module.exports = new VapiService();

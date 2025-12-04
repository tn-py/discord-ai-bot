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

            // Initiate the call with WebSocket transport
            const response = await this.client.post('/call', {
                assistantId: config.vapi.assistantId,
                transport: {
                    provider: 'vapi.websocket',
                    audioFormat: {
                        format: 'pcm_s16le',
                        container: 'raw',
                        sampleRate: 16000
                    }
                },
                name: `Discord-${channelId}`
            });

            const call = response.data;
            logger.info(`VAPI Call Response: ${JSON.stringify(call, null, 2)}`);

            // Extract WebSocket URL from transport.websocketCallUrl
            const webCallUrl =
                (call.transport && call.transport.websocketCallUrl) ||
                call.webCallUrl ||
                call.websocketCallUrl ||
                (call.monitor && call.monitor.listenUrl);

            // Check if there's a separate listen URL
            if (call.monitor && call.monitor.listenUrl) {
                logger.info(`Monitor listenUrl found: ${call.monitor.listenUrl}`);
            }

            if (!webCallUrl) {
                logger.error(`Full VAPI Response: ${JSON.stringify(call, null, 2)}`);
                throw new Error('No WebSocket URL found in VAPI response');
            }

            this.sessionId = call.id;

            logger.info(`VAPI WebSocket URL obtained: ${webCallUrl}`);
            logger.info(`Session ID: ${this.sessionId}`);

            // Connect to WebSocket
            this.ws = new WebSocket(webCallUrl);

            this.ws.on('open', () => {
                logger.info('Connected to VAPI WebSocket');
                this.emit('open');

                // Send a small buffer of silence to trigger VAPI to start sending audio
                // 16kHz, 16-bit PCM, mono = 32000 bytes per second
                // Send 100ms of silence (3200 bytes)
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
            logger.debug(`Sending ${buffer.length} bytes of audio to VAPI`);
            this.ws.send(buffer);
        } else {
            logger.warn(`Cannot send audio - WebSocket state: ${this.ws ? this.ws.readyState : 'null'}`);
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

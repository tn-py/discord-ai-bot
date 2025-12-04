const {
    joinVoiceChannel,
    getVoiceConnection,
    VoiceConnectionStatus,
    entersState,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior,
    AudioPlayerStatus,
    StreamType,
    EndBehaviorType
} = require('@discordjs/voice');
const { PassThrough } = require('stream');
const logger = require('../utils/logger');
const vapiService = require('./vapi');
const prism = require('prism-media');

class VoiceService {
    constructor() {
        this.streams = new Map(); // Map<guildId, { speaker: PassThrough, player: AudioPlayer }>
    }

    /**
     * Join a voice channel
     * @param {VoiceChannel} channel - Discord voice channel
     */
    async joinChannel(channel) {
        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            connection.on(VoiceConnectionStatus.Ready, async () => {
                try {
                    logger.info(`Joined voice channel: ${channel.name}`);

                    // Setup audio player for VAPI output (Speaker)
                    logger.debug('Setting up audio player...');
                    const speakerStream = new PassThrough();
                    const player = createAudioPlayer({
                        behaviors: {
                            noSubscriber: NoSubscriberBehavior.Play,
                        },
                    });

                    logger.debug('Creating audio resource...');
                    const resource = createAudioResource(speakerStream, {
                        inputType: StreamType.Raw
                    });

                    logger.debug('Playing resource and subscribing...');
                    player.play(resource);
                    connection.subscribe(player);

                    this.streams.set(channel.guild.id, { speaker: speakerStream, player });

                    // Handle VAPI audio events
                    logger.debug('Setting up VAPI event listeners...');
                    const onVapiAudio = (buffer) => {
                        speakerStream.write(buffer);
                    };

                    vapiService.on('audio', onVapiAudio);

                    // Handle VAPI close/error to cleanup
                    const onVapiClose = () => {
                        this.leaveChannel(channel.guild.id);
                    };
                    vapiService.once('close', onVapiClose);
                    vapiService.once('error', onVapiClose);

                    // Setup audio receiver for Discord input (Microphone)
                    logger.debug('Setting up audio receiver...');
                    if (!connection.receiver) {
                        throw new Error('Voice connection receiver is undefined');
                    }

                    connection.receiver.speaking.on('start', (userId) => {
                        logger.debug(`User ${userId} started speaking`);

                        const opusStream = connection.receiver.subscribe(userId, {
                            end: {
                                behavior: EndBehaviorType.AfterSilence,
                                duration: 100,
                            },
                        });

                        // Decode Opus to PCM (48kHz, 2 channels)
                        const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });

                        // Resample from 48kHz stereo to 16kHz mono for VAPI
                        const ffmpeg = new prism.FFmpeg({
                            args: [
                                '-f', 's16le',
                                '-ar', '48000',
                                '-ac', '2',
                                '-i', 'pipe:0',
                                '-f', 's16le',
                                '-ar', '16000',
                                '-ac', '1',
                                'pipe:1'
                            ]
                        });

                        opusStream.pipe(decoder).pipe(ffmpeg);

                        ffmpeg.on('data', (pcmData) => {
                            vapiService.sendAudio(pcmData);
                        });

                        decoder.on('error', (err) => {
                            logger.error(`Opus decoder error for user ${userId}:`, err);
                        });

                        ffmpeg.on('error', (err) => {
                            logger.error(`FFmpeg resampling error for user ${userId}:`, err);
                        });
                    });

                    // Start VAPI call
                    logger.debug('Starting VAPI call...');
                    await vapiService.startCall(channel.id);
                    logger.debug('VAPI call started successfully.');

                } catch (error) {
                    logger.error('Error in VoiceConnectionStatus.Ready handler:', error);
                    // Try to log detailed error info
                    try {
                        logger.error('Detailed error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
                    } catch (e) {
                        logger.error('Could not stringify error');
                    }
                    this.leaveChannel(channel.guild.id);
                }
            });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    connection.destroy();
                    logger.info(`Disconnected from voice channel: ${channel.name}`);
                    this.cleanup(channel.guild.id);
                }
            });

            return connection;
        } catch (error) {
            logger.error(`Error joining voice channel ${channel.name}:`, error);
            throw error;
        }
    }

    /**
     * Leave a voice channel
     * @param {string} guildId - Guild ID
     */
    leaveChannel(guildId) {
        const connection = getVoiceConnection(guildId);
        if (connection) {
            connection.destroy();
            logger.info(`Left voice channel in guild: ${guildId}`);
        }
        this.cleanup(guildId);
    }

    cleanup(guildId) {
        const streamData = this.streams.get(guildId);
        if (streamData) {
            streamData.player.stop();
            streamData.speaker.end();
            this.streams.delete(guildId);
        }
        vapiService.stopCall();
        vapiService.removeAllListeners('audio');
        vapiService.removeAllListeners('close');
        vapiService.removeAllListeners('error');
    }
}

module.exports = new VoiceService();

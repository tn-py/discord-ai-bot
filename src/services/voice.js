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
                logger.info(`Joined voice channel: ${channel.name}`);

                // Setup audio player for VAPI output (Speaker)
                const speakerStream = new PassThrough();
                const player = createAudioPlayer({
                    behaviors: {
                        noSubscriber: NoSubscriberBehavior.Play,
                    },
                });

                const resource = createAudioResource(speakerStream, {
                    inputType: StreamType.Raw
                });

                player.play(resource);
                connection.subscribe(player);

                this.streams.set(channel.guild.id, { speaker: speakerStream, player });

                // Handle VAPI audio events
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
                connection.receiver.speaking.on('start', (userId) => {
                    const opusStream = connection.receiver.subscribe(userId, {
                        end: {
                            behavior: EndBehaviorType.AfterSilence,
                            duration: 100,
                        },
                    });

                    // Decode Opus to PCM (48kHz, 1 channel)
                    const decoder = new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 });

                    opusStream.pipe(decoder);

                    decoder.on('data', (pcmData) => {
                        // Resample if necessary? VAPI usually handles 48k.
                        // But if VAPI expects 16k, we might need to downsample.
                        // For now, send 48k and see.
                        vapiService.sendAudio(pcmData);
                    });

                    decoder.on('error', (err) => {
                        logger.error(`Opus decoder error for user ${userId}:`, err);
                    });
                });

                // Start VAPI call
                try {
                    await vapiService.startCall(channel.id);
                } catch (error) {
                    logger.error('Failed to start VAPI call:', error);
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

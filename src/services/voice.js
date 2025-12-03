const {
    joinVoiceChannel,
    getVoiceConnection,
    VoiceConnectionStatus,
    entersState,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior,
    AudioPlayerStatus,
    StreamType
} = require('@discordjs/voice');
const logger = require('../utils/logger');
const vapiService = require('./vapi');
const prism = require('prism-media');

class VoiceService {
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

            connection.on(VoiceConnectionStatus.Ready, () => {
                logger.info(`Joined voice channel: ${channel.name}`);

                // Play a welcome sound to establish audio stream
                try {
                    const player = createAudioPlayer({
                        behaviors: {
                            noSubscriber: NoSubscriberBehavior.Play,
                        },
                    });

                    connection.subscribe(player);
                    logger.info('Audio player subscribed to connection');

                    // Debug: Log all state changes
                    player.on('stateChange', (oldState, newState) => {
                        logger.info(`Audio player transitioned from ${oldState.status} to ${newState.status}`);
                    });

                    player.on('error', error => {
                        logger.error('Audio player error:', error);
                    });

                    // Generate a 440Hz sine wave using FFmpeg
                    // This rules out network issues with external URLs
                    const args = [
                        '-f', 'lavfi',
                        '-i', 'sine=frequency=440:duration=3', // 3 seconds of 440Hz beep
                        '-f', 's16le',
                        '-ar', '48000',
                        '-ac', '2'
                    ];

                    const ffmpeg = new prism.FFmpeg({ args });
                    const resource = createAudioResource(ffmpeg, {
                        inputType: StreamType.Raw
                    });

                    player.play(resource);
                    logger.info('Playing generated test tone');

                    // Trigger VAPI session
                    vapiService.startCall(channel.id);
                } catch (error) {
                    logger.error('Error setting up audio player:', error);
                }
            });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                    // Seems to be reconnecting to a new channel - ignore disconnect
                } catch (error) {
                    // Seems to be a real disconnect which SHOULDN'T be recovered from
                    connection.destroy();
                    logger.info(`Disconnected from voice channel: ${channel.name}`);
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
    }
}

module.exports = new VoiceService();

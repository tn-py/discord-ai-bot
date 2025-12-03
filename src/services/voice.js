const {
    joinVoiceChannel,
    getVoiceConnection,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const logger = require('../utils/logger');
const vapiService = require('./vapi');

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
                // Trigger VAPI session when ready
                vapiService.startCall(channel.id);
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

const logger = require('../utils/logger');
const voiceService = require('../services/voice');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        // Ignore bot's own state updates
        if (newState.member.user.bot) return;

        // Check if user joined a channel
        if (!oldState.channelId && newState.channelId) {
            const channel = newState.channel;

            // Check if channel name is exactly "GiGi"
            if (channel.name === 'GiGi') {
                logger.info(`User ${newState.member.user.tag} joined GiGi channel. Bot joining...`);
                try {
                    await voiceService.joinChannel(channel);
                } catch (error) {
                    logger.error('Failed to join GiGi channel:', error);
                }
            }
        }

        // Check if user left the channel and it's empty (except bot)
        if (oldState.channelId && !newState.channelId) {
            const channel = oldState.channel;
            if (channel.name === 'GiGi' && channel.members.size === 1 && channel.members.has(channel.client.user.id)) {
                logger.info('GiGi channel empty. Bot leaving...');
                voiceService.leaveChannel(channel.guild.id);
            }
        }
    }
};

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

        // Check if user left the GiGi channel (either disconnected or moved)
        if (oldState.channelId && oldState.channel.name === 'GiGi') {
            const channel = oldState.channel;

            logger.debug(`User left GiGi channel. Members count: ${channel.members.size}`);
            channel.members.forEach(member => {
                logger.debug(`Member in channel: ${member.user.tag} (Bot: ${member.user.bot})`);
            });

            // Check if channel is empty (except bot)
            // We filter members to ignore bots, or just check if size is 1 (the bot itself)
            const humans = channel.members.filter(member => !member.user.bot);

            logger.debug(`Human members remaining: ${humans.size}`);

            if (humans.size === 0) {
                logger.info('GiGi channel empty (no humans). Bot leaving...');
                voiceService.leaveChannel(channel.guild.id);
            }
        }
    }
};

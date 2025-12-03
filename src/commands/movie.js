const { SlashCommandBuilder } = require('discord.js');
const movieService = require('../services/movie');
const logger = require('../utils/logger');
const { handleInteractionError } = require('../utils/errors');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('movie')
        .setDescription('Get information about a movie')
        .addStringOption(option =>
            option
                .setName('title')
                .setDescription('The title of the movie')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('year')
                .setDescription('The release year of the movie')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const title = interaction.options.getString('title');
            const year = interaction.options.getInteger('year');

            logger.info(`Movie request for: ${title} (${year || 'any'})`, {
                userId: interaction.user.id,
                guildId: interaction.guildId
            });

            const movie = await movieService.getMovie(title, year);
            const response = movieService.formatMovieMessage(movie);

            await interaction.editReply(response);

            logger.debug('Movie command completed successfully', {
                userId: interaction.user.id,
                movieTitle: movie?.Title
            });
        } catch (error) {
            await handleInteractionError(error, interaction);
        }
    }
};

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { APIError } = require('../utils/errors');

class MovieService {
    constructor() {
        this.client = axios.create({
            baseURL: config.movie.baseUrl,
            params: {
                apikey: config.movie.apiKey
            }
        });
    }

    /**
     * Get movie details by title and optional year
     * @param {string} title - Movie title
     * @param {number} [year] - Release year
     * @returns {Promise<Object>} Movie data
     */
    async getMovie(title, year) {
        try {
            const params = { t: title };
            if (year) {
                params.y = year;
            }

            const response = await this.client.get('', { params });

            if (response.data.Response === 'False') {
                logger.warn(`Movie not found: ${title} (${year || 'any year'}) - ${response.data.Error}`);
                return null;
            }

            return response.data;
        } catch (error) {
            logger.error('Error fetching movie data:', error);
            throw new APIError(
                'Failed to fetch movie data',
                error.response?.status || 500,
                'OMDb API'
            );
        }
    }

    /**
     * Format movie data for Discord message
     * @param {Object} movie - Movie data from OMDb
     * @returns {Object} Discord embed or message content
     */
    formatMovieMessage(movie) {
        if (!movie) {
            return 'Movie not found. Please check the title and try again.';
        }

        const ratings = movie.Ratings?.map(r => `${r.Source}: ${r.Value}`).join('\n') || 'N/A';

        return {
            embeds: [{
                title: `${movie.Title} (${movie.Year})`,
                url: `https://www.imdb.com/title/${movie.imdbID}/`,
                color: 0xF5C518, // IMDb yellow
                thumbnail: {
                    url: movie.Poster !== 'N/A' ? movie.Poster : undefined
                },
                fields: [
                    { name: 'Plot', value: movie.Plot || 'N/A' },
                    { name: 'Director', value: movie.Director || 'N/A', inline: true },
                    { name: 'Cast', value: movie.Actors || 'N/A', inline: true },
                    { name: 'Genre', value: movie.Genre || 'N/A', inline: true },
                    { name: 'Runtime', value: movie.Runtime || 'N/A', inline: true },
                    { name: 'Ratings', value: ratings, inline: false }
                ],
                footer: {
                    text: `Released: ${movie.Released}`
                }
            }]
        };
    }
}

module.exports = new MovieService();

const movieService = require('../movie');
const config = require('../../config');
const logger = require('../../utils/logger');
const { APIError } = require('../../utils/errors');

// Mock axios
const mockGet = jest.fn();
jest.mock('axios', () => ({
    create: jest.fn(() => ({
        get: mockGet
    }))
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

describe('Movie Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getMovie', () => {
        it('should return movie data when found', async () => {
            const mockMovie = {
                Title: 'Inception',
                Year: '2010',
                Response: 'True'
            };
            mockGet.mockResolvedValue({ data: mockMovie });

            const result = await movieService.getMovie('Inception');
            expect(result).toEqual(mockMovie);
            expect(mockGet).toHaveBeenCalledWith('', { params: { t: 'Inception' } });
        });

        it('should return null and log warning when movie not found', async () => {
            mockGet.mockResolvedValue({
                data: { Response: 'False', Error: 'Movie not found!' }
            });

            const result = await movieService.getMovie('NonExistentMovie');
            expect(result).toBeNull();
            expect(logger.warn).toHaveBeenCalled();
        });

        it('should throw APIError on API failure', async () => {
            mockGet.mockRejectedValue(new Error('Network Error'));

            await expect(movieService.getMovie('Inception'))
                .rejects.toThrow(APIError);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('formatMovieMessage', () => {
        it('should return error message if movie is null', () => {
            const result = movieService.formatMovieMessage(null);
            expect(result).toContain('Movie not found');
        });

        it('should return formatted embed for valid movie', () => {
            const movie = {
                Title: 'Inception',
                Year: '2010',
                imdbID: 'tt1375666',
                Poster: 'http://example.com/poster.jpg',
                Plot: 'Dream within a dream',
                Director: 'Christopher Nolan',
                Actors: 'Leonardo DiCaprio',
                Genre: 'Sci-Fi',
                Runtime: '148 min',
                Released: '16 Jul 2010',
                Ratings: [{ Source: 'Internet Movie Database', Value: '8.8/10' }]
            };

            const result = movieService.formatMovieMessage(movie);
            expect(result.embeds[0].title).toBe('Inception (2010)');
            expect(result.embeds[0].fields).toHaveLength(6);
        });
    });
});

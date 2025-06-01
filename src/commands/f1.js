const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const xml2js = require('xml2js');
const logger = require('../utils/logger');

const parser = new xml2js.Parser({ explicitArray: false });

async function fetchF1Data() {
    logger.info('Fetching F1 data from Ergast API...');
    try {
        const url = 'http://ergast.com/api/f1/current/last/results';
        logger.info(`Making GET request to: ${url}`);
        
        const response = await axios.get(url);
        logger.info('Successfully received API response');
        logger.debug('API Response Status:', response.status);
        
        logger.info('Parsing XML response...');
        const result = await parser.parseStringPromise(response.data);
        logger.info('Successfully parsed XML data');
        
        // Log race information for debugging
        const raceName = result.MRData?.RaceTable?.Race?.RaceName;
        const circuit = result.MRData?.RaceTable?.Race?.Circuit?.CircuitName;
        logger.info(`Fetched data for race: ${raceName} at ${circuit}`);
        
        return result;
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            logger.error('API Error Response:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        } else if (error.request) {
            // The request was made but no response was received
            logger.error('No response received from API:', error.message);
        } else {
            // Something happened in setting up the request that triggered an Error
            logger.error('Error setting up API request:', error.message);
        }
        
        if (error.config) {
            logger.debug('Failed request config:', {
                method: error.config.method,
                url: error.config.url,
                headers: error.config.headers
            });
        }
        
        throw new Error('Failed to fetch F1 data. Please try again later.');
    }
}

function formatTime(timeStr) {
    return timeStr || 'N/A';
}

function createRaceEmbed(data) {
    const race = data.MRData.RaceTable.Race;
    const results = race.ResultsList.Result;

    // Create the main race information
    let raceInfo = `🏎️ **${race.RaceName}**\n`;
    raceInfo += `🏁 Circuit: ${race.Circuit.CircuitName}\n`;
    raceInfo += `📍 Location: ${race.Circuit.Location.Locality}, ${race.Circuit.Location.Country}\n`;
    raceInfo += `📅 Date: ${race.Date}\n\n`;

    // Create podium section
    let podium = '🏆 **Podium**\n';
    for (let i = 0; i < 3; i++) {
        const driver = results[i];
        podium += `${i + 1}. ${driver.Driver.GivenName} ${driver.Driver.FamilyName} (${driver.Constructor.Name}) `;
        podium += `- ${formatTime(driver.Time ? driver.Time._ : driver.Status)}\n`;
    }

    // Create full results table
    let fullResults = '\n📊 **Full Results**\n```\nPos  Driver                  Time/Status          Points\n';
    fullResults += '──────────────────────────────────────────────────────\n';
    
    results.forEach(result => {
        const driverName = `${result.Driver.GivenName} ${result.Driver.FamilyName}`.padEnd(20);
        const timeStatus = (result.Time ? result.Time._ : result.Status).padEnd(18);
        const points = result.points.padStart(3);
        
        fullResults += `${result.position.padStart(2)}   ${driverName} ${timeStatus} ${points}\n`;
    });
    fullResults += '```\n';

    // Add fastest lap information
    const fastestLap = results.reduce((fastest, current) => {
        if (!fastest || !fastest.FastestLap) return current;
        if (!current.FastestLap) return fastest;
        return parseFloat(current.FastestLap.Time) < parseFloat(fastest.FastestLap.Time) ? current : fastest;
    });

    let fastestLapInfo = '⚡ **Fastest Lap**\n';
    if (fastestLap.FastestLap) {
        fastestLapInfo += `${fastestLap.Driver.GivenName} ${fastestLap.Driver.FamilyName} - ${fastestLap.FastestLap.Time}\n`;
        fastestLapInfo += `Lap: ${fastestLap.FastestLap.lap} | Avg Speed: ${fastestLap.FastestLap.AverageSpeed._} ${fastestLap.FastestLap.AverageSpeed.$.units}\n`;
    }

    return `${raceInfo}${podium}\n${fullResults}\n${fastestLapInfo}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('f1')
        .setDescription('Formula 1 commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Check F1 information')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of information to check')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Latest Race Stats', value: 'stats' }
                        )
                )
        ),

    async execute(interaction) {
        const type = interaction.options.getString('type');

        if (type === 'stats') {
            logger.info(`User ${interaction.user.tag} requested F1 stats`);
            await interaction.deferReply();

            try {
                logger.info('Fetching F1 data...');
                const data = await fetchF1Data();
                
                logger.info('Formatting race data for Discord...');
                const formattedResponse = createRaceEmbed(data);
                
                logger.info('Sending formatted response to Discord...');
                await interaction.editReply({
                    content: formattedResponse,
                    allowedMentions: { parse: [] }
                });
                logger.info('Successfully sent F1 stats to Discord');
            } catch (error) {
                logger.error('Error in F1 command:', {
                    error: error.message,
                    stack: error.stack,
                    user: interaction.user.tag,
                    guild: interaction.guild.name
                });
                
                await interaction.editReply({
                    content: '❌ Sorry, there was an error fetching F1 data. Please try again later.',
                    ephemeral: true
                });
            }
        }
    }
};
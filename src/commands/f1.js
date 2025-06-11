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
        logger.info(`Successfully received API response with status: ${response.status}`);
        
        // Log a sample of the response data for debugging
        const responsePreview = response.data.substring(0, 200) + '...';
        logger.debug('Response data preview:', { data: responsePreview });
        
        logger.info('Parsing XML response...');
        const result = await parser.parseStringPromise(response.data);
        logger.info('Successfully parsed XML data');
        
        // Validate the parsed data structure
        if (!result?.MRData?.RaceTable?.Race) {
            throw new Error('Invalid data structure in API response');
        }
        
        // Log race information for debugging
        const raceName = result.MRData.RaceTable.Race.RaceName;
        const circuit = result.MRData.RaceTable.Race.Circuit.CircuitName;
        const date = result.MRData.RaceTable.Race.Date;
        logger.info('Fetched race data:', {
            raceName,
            circuit,
            date,
            resultCount: result.MRData.RaceTable.Race.ResultsList.Result.length
        });
        
        return result;
    } catch (error) {
        // Use the logger's error helper for comprehensive error logging
        logger.logError(error, {
            context: 'F1 API Request',
            url: 'http://ergast.com/api/f1/current/last/results',
            timestamp: new Date().toISOString()
        });
        
        // Throw a more specific error if we can determine the cause
        if (error.response?.status === 429) {
            throw new Error('F1 API rate limit exceeded. Please try again in a few minutes.');
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            throw new Error('Unable to connect to F1 API. The service may be down.');
        } else if (error.message === 'Invalid data structure in API response') {
            throw new Error('Received unexpected data format from F1 API.');
        }
        
        throw new Error('Failed to fetch F1 data. Please try again later.');
    }
}

function formatTime(timeStr) {
    return timeStr || 'N/A';
}

function createRaceEmbed(data) {
    const race = data?.MRData?.RaceTable?.Race;
    if (!race) {
        throw new Error('Invalid race data structure');
    }

    const results = Array.isArray(race.ResultsList?.Result) ? race.ResultsList.Result : [];
    if (results.length === 0) {
        throw new Error('No race results available');
    }

    // Create the main race information
    let raceInfo = `🏎️ **${race.RaceName || 'Unknown Race'}**\n`;
    raceInfo += `🏁 Circuit: ${race.Circuit?.CircuitName || 'Unknown Circuit'}\n`;
    raceInfo += `📍 Location: ${race.Circuit?.Location?.Locality || 'Unknown'}, ${race.Circuit?.Location?.Country || 'Unknown'}\n`;
    raceInfo += `📅 Date: ${race.Date || 'Date not available'}\n\n`;

    // Create podium section
    let podium = '🏆 **Podium**\n';
    for (let i = 0; i < Math.min(3, results.length); i++) {
        const driver = results[i];
        if (!driver) continue;
        
        const driverName = `${driver.Driver?.GivenName || ''} ${driver.Driver?.FamilyName || ''}`.trim();
        const constructor = driver.Constructor?.Name || 'Unknown Team';
        const time = formatTime(driver.Time?._ || driver.Status);
        
        podium += `${i + 1}. ${driverName} (${constructor}) - ${time}\n`;
    }

    // Create nationality to flag emoji mapping
    const nationalityToFlag = {
        'British': '🇬🇧',
        'Spanish': '🇪🇸',
        'Monegasque': '🇲🇨',
        'Dutch': '🇳🇱',
        'French': '🇫🇷',
        'German': '🇩🇪',
        'Australian': '🇦🇺',
        'Thai': '🇹🇭',
        'Japanese': '🇯🇵',
        'Chinese': '🇨🇳',
        'Canadian': '🇨🇦',
        'Danish': '🇩🇰',
        'Finnish': '🇫🇮',
        'Mexican': '🇲🇽',
        'Italian': '🇮🇹',
        'American': '🇺🇸',
        'Swiss': '🇨🇭',
        'New Zealander': '🇳🇿',
        'Argentinian': '🇦🇷'
    };

    // Create full results table
    let fullResults = '\n📊 **Full Results**\n```\nPos  Nat. Driver                  Time/Status          Points\n';
    fullResults += '────────────────────────────────────────────────────────────\n';
    
    results.forEach(result => {
        const driverName = `${result.Driver?.GivenName || ''} ${result.Driver?.FamilyName || ''}`.trim().padEnd(20);
        
        // Handle different time/status formats
        let timeStatus;
        if (result.Time?._) {
            // For finished drivers with time
            timeStatus = result.Time._.includes('+') ? result.Time._ : result.Time._.split('.')[0];
        } else if (result.Status?._ === 'Finished') {
            timeStatus = result.Time?._ || 'Finished';
        } else if (result.Status?.includes && result.Status.includes('Lap')) {
            // For lapped drivers
            timeStatus = result.Status;
        } else if (result.Status?._) {
            // For special statuses like Engine, Collision, etc.
            timeStatus = result.Status._;
        } else {
            // Fallback for any other status
            timeStatus = result.Status || 'N/A';
        }
        
        // Get points and position from result attributes
        const points = result.$.points || '0';
        const position = result.$.positionText || result.$.position || '-';
        
        // Get nationality and corresponding flag
        const nationality = result.Driver?.Nationality || '';
        const flag = nationalityToFlag[nationality] || '🏳️';

        // Format the line with proper padding
        fullResults += `${position.toString().padStart(2)}   ${flag}  ${driverName} ${String(timeStatus).padEnd(18)} ${points.toString().padStart(3)}\n`;
    });
    fullResults += '```\n';

    // Add fastest lap information
    const fastestLap = results.reduce((fastest, current) => {
        if (!fastest || !fastest.FastestLap) return current;
        if (!current.FastestLap) return fastest;
        return parseFloat(current.FastestLap.Time) < parseFloat(fastest.FastestLap.Time) ? current : fastest;
    });

    let fastestLapInfo = '⚡ **Fastest Lap**\n';
    if (fastestLap?.FastestLap) {
        const driverName = `${fastestLap.Driver?.GivenName || ''} ${fastestLap.Driver?.FamilyName || ''}`.trim();
        const lapTime = fastestLap.FastestLap?.Time || 'N/A';
        const lapNumber = fastestLap.FastestLap?.lap || 'N/A';
        const avgSpeed = fastestLap.FastestLap?.AverageSpeed?._  || 'N/A';
        const units = fastestLap.FastestLap?.AverageSpeed?.$ ? fastestLap.FastestLap.AverageSpeed.$.units : 'KPH';
        
        fastestLapInfo += `${driverName} - ${lapTime}\n`;
        fastestLapInfo += `Lap: ${lapNumber} | Avg Speed: ${avgSpeed} ${units}\n`;
    } else {
        fastestLapInfo += 'No fastest lap data available\n';
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
            const commandStart = Date.now();
            logger.info('F1 stats command initiated:', {
                user: interaction.user.tag,
                userId: interaction.user.id,
                guild: interaction.guild.name,
                guildId: interaction.guild.id,
                timestamp: new Date().toISOString()
            });

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

                const executionTime = Date.now() - commandStart;
                logger.info('F1 stats command completed successfully', {
                    executionTime: `${executionTime}ms`,
                    user: interaction.user.tag,
                    guild: interaction.guild.name
                });
            } catch (error) {
                const executionTime = Date.now() - commandStart;
                logger.logError(error, {
                    context: 'F1 Command Execution',
                    user: interaction.user.tag,
                    userId: interaction.user.id,
                    guild: interaction.guild.name,
                    guildId: interaction.guild.id,
                    executionTime: `${executionTime}ms`,
                    timestamp: new Date().toISOString()
                });
                
                // Send a more specific error message to the user if possible
                let errorMessage = '❌ Sorry, there was an error fetching F1 data. Please try again later.';
                if (error.message.includes('rate limit')) {
                    errorMessage = '❌ The F1 API is currently rate limited. Please try again in a few minutes.';
                } else if (error.message.includes('Unable to connect')) {
                    errorMessage = '❌ Unable to connect to the F1 API. The service may be down.';
                } else if (error.message.includes('unexpected data format')) {
                    errorMessage = '❌ Received unexpected data from the F1 API. This might be a temporary issue.';
                }
                
                await interaction.editReply({
                    content: errorMessage,
                    ephemeral: true
                });
            }
        }
    }
};
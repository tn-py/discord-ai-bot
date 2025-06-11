const sendTextCommand = require('../send_text');
const twilioService = require('../../services/twilio');
const logger = new require('../../utils/logger'); // Actual logger for spy

// Mock the twilioService
jest.mock('../../services/twilio', () => ({
  sendTextMessage: jest.fn(),
  isConfigured: jest.fn(),
}));

// Mock logger (actual logger for spy, mock others if necessary)
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock handleInteractionError if it's used and you want to assert its call
jest.mock('../../utils/errors', () => ({
    handleInteractionError: jest.fn(),
}));


describe('/send_text Command', () => {
  let mockInteraction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInteraction = {
      options: {
        getString: jest.fn(),
      },
      reply: jest.fn().mockResolvedValue(true),
      editReply: jest.fn().mockResolvedValue(true),
      deferReply: jest.fn().mockResolvedValue(true),
      user: {
        tag: 'testuser#1234',
      },
      replied: false,
      deferred: false,
    };
  });

  it('should reply that service is not configured if twilioService.isConfigured() is false', async () => {
    twilioService.isConfigured.mockReturnValue(false);

    await sendTextCommand.execute(mockInteraction);

    expect(twilioService.isConfigured).toHaveBeenCalledTimes(1);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'The SMS service is not configured. Please contact the bot administrator.',
      ephemeral: true,
    });
    expect(twilioService.sendTextMessage).not.toHaveBeenCalled();
  });

  it('should reply with invalid phone number format if format is incorrect', async () => {
    twilioService.isConfigured.mockReturnValue(true);
    mockInteraction.options.getString.mockImplementation(optionName => {
      if (optionName === 'phone_number') return '12345'; // Invalid format
      if (optionName === 'message') return 'Test message';
      return null;
    });

    await sendTextCommand.execute(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Invalid phone number format. Please use E.164 format (e.g., +12345678900).',
      ephemeral: true,
    });
    expect(twilioService.sendTextMessage).not.toHaveBeenCalled();
  });

  it('should call twilioService.sendTextMessage and reply with success on valid input', async () => {
    twilioService.isConfigured.mockReturnValue(true);
    const testPhoneNumber = '+12345678900';
    const testMessage = 'This is a test message';
    mockInteraction.options.getString.mockImplementation(optionName => {
      if (optionName === 'phone_number') return testPhoneNumber;
      if (optionName === 'message') return testMessage;
      return null;
    });
    twilioService.sendTextMessage.mockResolvedValue({ sid: 'SMxxxxxxxxxxxx' });

    await sendTextCommand.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(twilioService.sendTextMessage).toHaveBeenCalledWith(testPhoneNumber, testMessage);
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: `Message sent successfully to ${testPhoneNumber}!`,
    });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Successfully sent SMS via /send_text command to ${testPhoneNumber}`));
  });

  it('should handle errors from twilioService.sendTextMessage and reply with failure', async () => {
    twilioService.isConfigured.mockReturnValue(true);
    const testPhoneNumber = '+12345678900';
    const testMessage = 'This is a test message';
    mockInteraction.options.getString.mockImplementation(optionName => {
      if (optionName === 'phone_number') return testPhoneNumber;
      if (optionName === 'message') return testMessage;
      return null;
    });
    const errorMessage = 'Twilio API is down';
    twilioService.sendTextMessage.mockRejectedValue(new Error(errorMessage));

    await sendTextCommand.execute(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(twilioService.sendTextMessage).toHaveBeenCalledWith(testPhoneNumber, testMessage);
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: `Failed to send message: ${errorMessage}`,
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to send SMS via /send_text command'), expect.any(Error));
  });

  it('should handle generic errors during execution', async () => {
    twilioService.isConfigured.mockReturnValue(true);
    mockInteraction.options.getString.mockImplementation(() => { throw new Error('Unexpected option error'); });

    await sendTextCommand.execute(mockInteraction);

    expect(logger.error).toHaveBeenCalledWith('Error in send_text command execution:', expect.any(Error));
    // Depending on when the error happens, either reply or editReply would be called
    // For this specific mock, deferReply won't be called.
    expect(mockInteraction.reply).toHaveBeenCalledWith({ content: 'An error occurred while processing your request.', ephemeral: true });
  });
});

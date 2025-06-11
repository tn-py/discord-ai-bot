const twilioService = require('../twilio');
const config = require('../../config');
const logger = require('../../utils/logger');

// Mock the Twilio library
jest.mock('twilio', () => {
  const mockMessagesCreate = jest.fn();
  return jest.fn(() => ({
    messages: {
      create: mockMessagesCreate,
    },
  }));
});

// Mock logger to prevent console output during tests
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Hold a reference to the mock function
let mockTwilioMessagesCreate;
beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
  // Get the fresh mock function instance
  const twilio = require('twilio');
  mockTwilioMessagesCreate = twilio().messages.create;
});

describe('Twilio Service', () => {
  describe('sendTextMessage', () => {
    const originalTwilioConfig = { ...config.twilio };

    beforeEach(() => {
      // Ensure a clean config state for Twilio
      config.twilio = { ...originalTwilioConfig };
       // Re-initialize the service to pick up the potentially changed config
       jest.isolateModules(() => {
        twilioService = require('../twilio');
      });
    });

    afterAll(() => {
      // Restore original config
      config.twilio = originalTwilioConfig;
    });

    it('should send a message successfully if configured', async () => {
      config.twilio.accountSid = 'ACxxxxxxxxxxxxxxx';
      config.twilio.authToken = 'authxxxxxxxxxxxxx';
      config.twilio.phoneNumber = '+1234567890';

      // Re-require the module to re-initialize the client with new config
      jest.isolateModules(() => {
        twilioService = require('../twilio');
      });

      mockTwilioMessagesCreate.mockResolvedValue({ sid: 'SMxxxxxxxxxxxxxxx' });

      const to = '+19876543210';
      const body = 'Test message';
      await twilioService.sendTextMessage(to, body);

      expect(mockTwilioMessagesCreate).toHaveBeenCalledWith({
        body: body,
        from: config.twilio.phoneNumber,
        to: to,
      });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('SMS sent successfully'));
    });

    it('should throw an error if Twilio is not configured', async () => {
      config.twilio.accountSid = ''; // Simulate not configured
       // Re-require the module to re-initialize the client with new config
      jest.isolateModules(() => {
        twilioService = require('../twilio');
      });

      await expect(twilioService.sendTextMessage('+19876543210', 'Test'))
        .rejects.toThrow('Twilio service is not configured.');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Twilio client is not initialized'));
    });

    it('should throw an error if "to" or "body" is missing', async () => {
      config.twilio.accountSid = 'ACxxxxxxxxxxxxxxx'; // Configured
      config.twilio.authToken = 'authxxxxxxxxxxxxx';
      config.twilio.phoneNumber = '+1234567890';
       // Re-require the module to re-initialize the client with new config
      jest.isolateModules(() => {
        twilioService = require('../twilio');
      });

      await expect(twilioService.sendTextMessage(null, 'Test'))
        .rejects.toThrow('Recipient phone number (to) and message body are required.');
      await expect(twilioService.sendTextMessage('+19876543210', null))
        .rejects.toThrow('Recipient phone number (to) and message body are required.');
    });

    it('should log a warning for invalid phone number format but attempt to send', async () => {
      config.twilio.accountSid = 'ACxxxxxxxxxxxxxxx';
      config.twilio.authToken = 'authxxxxxxxxxxxxx';
      config.twilio.phoneNumber = '+1234567890';
      jest.isolateModules(() => {
        twilioService = require('../twilio');
      });
      mockTwilioMessagesCreate.mockResolvedValue({ sid: 'SMxxxxxxxxxxxxxxx' });

      const invalidPhoneNumber = '12345';
      await twilioService.sendTextMessage(invalidPhoneNumber, 'Test message');

      expect(logger.warn).toHaveBeenCalledWith(`Invalid phone number format: ${invalidPhoneNumber}. Attempting to send anyway.`);
      expect(mockTwilioMessagesCreate).toHaveBeenCalled();
    });

    it('should throw an error if Twilio API call fails', async () => {
      config.twilio.accountSid = 'ACxxxxxxxxxxxxxxx';
      config.twilio.authToken = 'authxxxxxxxxxxxxx';
      config.twilio.phoneNumber = '+1234567890';
      jest.isolateModules(() => {
        twilioService = require('../twilio');
      });

      const errorMessage = 'Twilio API Error';
      mockTwilioMessagesCreate.mockRejectedValue(new Error(errorMessage));

      await expect(twilioService.sendTextMessage('+19876543210', 'Test'))
        .rejects.toThrow(`Failed to send SMS via Twilio: ${errorMessage}`);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error sending SMS'), expect.any(Error));
    });
  });

  describe('isConfigured', () => {
    // Similar setup for config and re-requiring module as above
    const originalTwilioConfig = { ...config.twilio };
     beforeEach(() => {
      config.twilio = { ...originalTwilioConfig };
    });
    afterAll(() => {
      config.twilio = originalTwilioConfig;
    });

    it('should return true if Twilio is fully configured', () => {
      config.twilio.accountSid = 'ACxxxxxxxxxxxxxxx';
      config.twilio.authToken = 'authxxxxxxxxxxxxx';
      config.twilio.phoneNumber = '+1234567890';
      jest.isolateModules(() => { // This ensures the module re-evaluates with the new config
        twilioService = require('../twilio');
      });
      expect(twilioService.isConfigured()).toBe(true);
    });

    it('should return false if Twilio configuration is incomplete', () => {
      config.twilio.accountSid = ''; // Missing accountSid
      jest.isolateModules(() => {
        twilioService = require('../twilio');
      });
      expect(twilioService.isConfigured()).toBe(false);
    });
  });
});

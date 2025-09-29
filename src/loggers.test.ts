import each from 'jest-each';
import { Response, HTTPError } from 'got/dist/source';
import { redact, redactSensitiveHeaders, redactSensitiveProps, GenericLogger } from './loggers';
import { RequestOptions, Logger } from './interfaces';

describe('log redaction', () => {
  test('should deep clone options', () => {
    const options = {
      headers: {
        authorization: 'a',
      },
      json: {
        password: 'p',
      },
    };
    const actual = redact(options);
    expect(actual).not.toBe(options);
    expect(actual).toStrictEqual({
      headers: {
        authorization: '<redacted>',
      },
      json: {
        password: '<redacted>',
      },
    });
  });

  each`
        input                       | expected
        ${{ ignoreMe: 'ignoreMe' }} | ${{ ignoreMe: 'ignoreMe' }}
        ${{ email: 'e' }}           | ${{ email: '<redacted>' }}
        ${{ Email: 'e' }}           | ${{ Email: '<redacted>' }}
        ${{ password: 'p' }}        | ${{ password: '<redacted>' }}
        ${{ Password: 'p' }}        | ${{ Password: '<redacted>' }}
        ${{ pass: 'p' }}            | ${{ pass: '<redacted>' }}
        ${{ Pass: 'p' }}            | ${{ Pass: '<redacted>' }}
        ${{ User: 'u' }}            | ${{ User: '<redacted>' }}
        ${{ user: 'u' }}            | ${{ user: '<redacted>' }}
        ${{ Username: 'u' }}        | ${{ Username: '<redacted>' }}
        ${{ username: 'u' }}        | ${{ username: '<redacted>' }}
        ${{ client_id: 'i' }}       | ${{ client_id: '<redacted>' }}
        ${{ clientId: 'i' }}        | ${{ clientId: '<redacted>' }}
        ${{ ClientId: 'i' }}        | ${{ ClientId: '<redacted>' }}
        ${{ client_secret: 's' }}   | ${{ client_secret: '<redacted>' }}
        ${{ clientSecret: 's' }}    | ${{ clientSecret: '<redacted>' }}
        ${{ ClientSecret: 's' }}    | ${{ ClientSecret: '<redacted>' }}
        ${{ token: 't' }}           | ${{ token: '<redacted>' }}
        ${{ Token: 't' }}           | ${{ Token: '<redacted>' }}
    `.describe('redact $input', ({ input, expected }) => {
    test(`from 'json'`, () => {
      const actual = { json: input } as RequestOptions;
      redactSensitiveProps(actual);
      expect(actual.json).toStrictEqual(expected);
    });

    test(`from 'form'`, () => {
      const actual = { form: input } as RequestOptions;
      redactSensitiveProps(actual);
      expect(actual.form).toStrictEqual(expected);
    });
  });

  each`
    input | expected
      ${{ authorization: 'a' }} | ${{ authorization: '<redacted>' }},
      ${{ Authorization: 'a' }} | ${{ Authorization: '<redacted>' }},
  `.test('redact $input from headers', ({ input, expected }) => {
    const actual = { headers: input } as RequestOptions;
    redactSensitiveHeaders(actual);
    expect(actual.headers).toStrictEqual(expected);
  });
});

describe('GenericLogger', () => {
  let mockLogger: jest.Mocked<Logger>;
  let genericLogger: GenericLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as jest.Mocked<Logger>;
    genericLogger = new GenericLogger(mockLogger);
  });

  describe('logSuccess', () => {
    it('should call logger with empty object as first parameter for POST requests', () => {
      const response = {
        url: 'https://api.example.com/users',
        statusCode: 200,
        timings: { start: 1000 }
      } as Response;

      const options = {
        method: 'POST'
      } as RequestOptions;

      genericLogger.logSuccess(response, options);

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      const [firstArg, secondArg] = mockLogger.info.mock.calls[0];
      expect(firstArg).toEqual({});
      expect(secondArg).toMatch(/^POST https:\/\/api\.example\.com\/users 200 \d+ ms$/);
    });

    it('should call logger.debug with empty object as first parameter for GET requests', () => {
      const response = {
        url: 'https://api.example.com/users',
        statusCode: 200,
        timings: { start: 1000 }
      } as Response;

      const options = {
        method: 'GET'
      } as RequestOptions;

      genericLogger.logSuccess(response, options);

      expect(mockLogger.debug).toHaveBeenCalledTimes(2);

      const [firstArg1, secondArg1] = mockLogger.debug.mock.calls[0];
      expect(firstArg1).toEqual({});
      expect(secondArg1).toMatch(/^GET https:\/\/api\.example\.com\/users 200 \d+ ms$/);

      const [firstArg2, secondArg2] = mockLogger.debug.mock.calls[1];
      expect(firstArg2).toEqual({ requestOptions: options });
      expect(secondArg2).toBe('request-options');
    });
  });

  describe('logFailure', () => {
    it('should call logger.error with empty object as first parameter', () => {
      const mockError = {
        options: {
          method: 'POST',
          context: 'test-context',
          headers: { 'content-type': 'application/json' }
        },
        request: {
          requestUrl: 'https://api.example.com/users'
        },
        response: {
          statusCode: 500
        },
        timings: {
          start: 1000,
          end: 1200,
          error: 1200
        },
        message: 'Internal Server Error',
        stack: 'Error stack trace'
      } as unknown as HTTPError;

      genericLogger.logFailure(mockError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [firstArg, secondArg] = mockLogger.error.mock.calls[0];
      expect(firstArg).toEqual({});
      expect(typeof secondArg).toBe('string');
      expect(secondArg).toContain('POST https://api.example.com/users 500');
      expect(secondArg).toContain('error: Internal Server Error');
    });
  });
});

import each from 'jest-each';
import { Response, HTTPError, RequestError } from 'got/dist/source';
import { redact, redactSensitiveHeaders, redactSensitiveProps, PinoLogger } from './loggers';
import { redactUrl } from './log-redaction';
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
      ${{ cookie: 'c' }} | ${{ cookie: '<redacted>' }},
      ${{ 'x-api-key': 'k' }} | ${{ 'x-api-key': '<redacted>' }},
      ${{ 'x-auth-token': 't' }} | ${{ 'x-auth-token': '<redacted>' }},
      ${{ 'content-type': 'application/json' }} | ${{ 'content-type': 'application/json' }},
  `.test('redact $input from headers', ({ input, expected }) => {
    const actual = { headers: input } as RequestOptions;
    redactSensitiveHeaders(actual);
    expect(actual.headers).toStrictEqual(expected);
  });
});

describe('redactUrl', () => {
  each`
    input                                                       | expected
    ${'https://user:pass@host/x'}                               | ${'https://<redacted>@host/x'}
    ${'https://host/x?access_token=s&page=2'}                   | ${'https://host/x?access_token=<redacted>&page=2'}
    ${'https://host/x?X-Amz-Signature=s&X-Amz-Credential=c'}    | ${'https://host/x?X-Amz-Signature=<redacted>&X-Amz-Credential=<redacted>'}
    ${'https://host/x?api-key=s&code=c&jwt=j&auth=a'}           | ${'https://host/x?api-key=<redacted>&code=<redacted>&jwt=<redacted>&auth=<redacted>'}
    ${'https://host/x?session_id=s&password=p'}                 | ${'https://host/x?session_id=<redacted>&password=<redacted>'}
    ${'https://host/x?passengers=3&userId=42&author=a'}         | ${'https://host/x?passengers=3&userId=42&author=a'}
    ${'undefined/x?token=s#frag'}                               | ${'undefined/x?token=<redacted>#frag'}
  `.test('redacts $input', ({ input, expected }) => {
    expect(redactUrl(input)).toBe(expected);
  });
});

describe('PinoLogger', () => {
  let mockLogger: jest.Mocked<Logger>;
  let pinoLogger: PinoLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as jest.Mocked<Logger>;
    pinoLogger = new PinoLogger(mockLogger);
  });

  describe('logSuccess', () => {
    it('should call logger.info with structured data and message for POST requests', () => {
      const response = {
        request: {
          options: {
            method: 'POST',
            url: 'https://api.example.com/users'
          }
        },
        statusCode: 200,
        statusMessage: 'OK',
        timings: { start: 1000, end: 1500 }
      } as Response;

      pinoLogger.logSuccess(response);

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      const [structuredData, message] = mockLogger.info.mock.calls[0];

      expect(structuredData).toEqual({
        req: {
          method: 'POST',
          url: 'https://api.example.com/users',
        },
        res: {
          statusCode: 200,
          statusMessage: 'OK',
        },
        responseTime: 500,
      });
      expect(message).toBe('POST https://api.example.com/users 200 OK 500ms');
    });

    it('should call logger.debug with structured data and message for GET requests', () => {
      const response = {
        request: {
          options: {
            method: 'GET',
            url: 'https://api.example.com/users/123'
          }
        },
        statusCode: 200,
        statusMessage: 'OK',
        timings: { start: 1000, end: 1200 }
      } as Response;

      pinoLogger.logSuccess(response);

      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      const [structuredData, message] = mockLogger.debug.mock.calls[0];

      expect(structuredData).toEqual({
        req: {
          method: 'GET',
          url: 'https://api.example.com/users/123',
        },
        res: {
          statusCode: 200,
          statusMessage: 'OK',
        },
        responseTime: 200,
      });
      expect(message).toBe('GET https://api.example.com/users/123 200 OK 200ms');
    });
  });

  describe('logFailure', () => {
    it('should call logger.error with structured data and message', () => {
      const mockError = {
        options: {
          method: 'POST',
          url: 'https://api.example.com/users',
          headers: { 'content-type': 'application/json' },
          json: { name: 'test' }
        },
        response: {
          statusCode: 500,
          statusMessage: 'Internal Server Error',
          headers: { 'content-type': 'application/json' },
          body: 'Internal Server Error'
        },
        timings: {
          start: 1000,
          end: 1300
        },
        message: 'Request failed',
        code: 'ERR_NON_2XX_3XX_RESPONSE'
      } as unknown as HTTPError;

      pinoLogger.logFailure(mockError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [structuredData, message] = mockLogger.error.mock.calls[0];

      expect(structuredData).toEqual({
        req: {
          method: 'POST',
          url: 'https://api.example.com/users',
          failed: true,
        },
        res: {
          statusCode: 500,
          statusMessage: 'Internal Server Error',
          failed: true,
        },
        err: {
          message: 'Request failed',
          code: 'ERR_NON_2XX_3XX_RESPONSE',
          statusCode: 500,
        },
        responseTime: 300,
      });
      expect(message).toBe('POST https://api.example.com/users 500 Internal Server Error 300ms');
    });

    it('should log a meaningful message for connection errors without request, response or timings', () => {
      const mockError = {
        name: 'TimeoutError',
        options: {
          method: 'POST',
          url: 'https://api.example.com/users',
        },
        message: "Timeout awaiting 'request' for 10000ms",
        code: 'ETIMEDOUT',
      } as unknown as RequestError;

      pinoLogger.logFailure(mockError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [structuredData, message] = mockLogger.error.mock.calls[0];

      expect(message).toBe('POST https://api.example.com/users ETIMEDOUT TimeoutError');
      expect(message).not.toContain('undefined');
      expect(structuredData).toEqual({
        req: {
          method: 'POST',
          url: 'https://api.example.com/users',
          failed: true,
        },
        res: {
          failed: true,
        },
        err: {
          message: "Timeout awaiting 'request' for 10000ms",
          code: 'ETIMEDOUT',
        },
      });
    });
  });

  describe('url redaction', () => {
    const url = new URL('https://api.example.com/users?access_token=SECRET&page=2');
    const redacted = 'https://api.example.com/users?access_token=<redacted>&page=2';

    it('redacts query secrets on success', () => {
      pinoLogger.logSuccess({
        request: { options: { method: 'GET', url } },
        statusCode: 200,
        statusMessage: 'OK',
        timings: { start: 1000, end: 1200 },
      } as unknown as Response);

      const [structuredData, message] = mockLogger.debug.mock.calls[0];
      expect(structuredData).toMatchObject({ req: { url: redacted } });
      expect(message).toBe(`GET ${redacted} 200 OK 200ms`);
    });

    it('redacts query secrets on failure', () => {
      pinoLogger.logFailure({
        name: 'RequestError',
        options: { method: 'GET', url },
        code: 'ECONNREFUSED',
      } as unknown as RequestError);

      const [structuredData, message] = mockLogger.error.mock.calls[0];
      expect(structuredData).toMatchObject({ req: { url: redacted } });
      expect(message).not.toContain('SECRET');
    });
  });
});

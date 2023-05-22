import each from 'jest-each';
import { redact, redactSensitiveHeaders, redactSensitiveProps } from './loggers';
import { RequestOptions } from './interfaces';

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

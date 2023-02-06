import test from 'ava';
import { redact, redactSensitiveHeaders, redactSensitiveProps } from '../src/loggers';

for (const [input, expected] of [
  [{ ignoreMe: 'ignoreMe' }, { ignoreMe: 'ignoreMe' }],
  [{ email: 'e' }, { email: '<redacted>' }],
  [{ Email: 'e' }, { Email: '<redacted>' }],
  [{ password: 'p' }, { password: '<redacted>' }],
  [{ Password: 'p' }, { Password: '<redacted>' }],
  [{ pass: 'p' }, { pass: '<redacted>' }],
  [{ Pass: 'p' }, { Pass: '<redacted>' }],
  [{ User: 'u' }, { User: '<redacted>' }],
  [{ user: 'u' }, { user: '<redacted>' }],
  [{ Username: 'u' }, { Username: '<redacted>' }],
  [{ username: 'u' }, { username: '<redacted>' }],
  [{ client_id: 'i' }, { client_id: '<redacted>' }],
  [{ clientId: 'i' }, { clientId: '<redacted>' }],
  [{ ClientId: 'i' }, { ClientId: '<redacted>' }],
  [{ client_secret: 's' }, { client_secret: '<redacted>' }],
  [{ clientSecret: 's' }, { clientSecret: '<redacted>' }],
  [{ ClientSecret: 's' }, { ClientSecret: '<redacted>' }],
  [{ token: 't' }, { token: '<redacted>' }],
  [{ Token: 't' }, { Token: '<redacted>' }],
]) {
  test(`redact '${[Object.keys(input)]}' from 'json'`, (t) => {
    const actual = { json: input };
    redactSensitiveProps(actual);
    t.deepEqual(actual.json, expected);
  });

  test(`redact '${[Object.keys(input)]}' from 'form'`, (t) => {
    const actual = { form: input };
    redactSensitiveProps(actual);
    t.deepEqual(actual.form, expected);
  });
}

for (const [input, expected] of [
  [{ authorization: 'a' }, { authorization: '<redacted>' }],
  [{ Authorization: 'a' }, { Authorization: '<redacted>' }],
]) {
  test(`redact '${[Object.keys(input)]}' from headers`, (t) => {
    const actual = { headers: input };
    redactSensitiveHeaders(actual);
    t.deepEqual(actual.headers, expected);
  });
}

test('should deep clone options', (t) => {
  const options = {
    headers: {
      authorization: 'a',
    },
    json: {
      password: 'p',
    },
  };
  const actual = redact(options);
  t.not(actual, options);
  t.deepEqual(actual, {
    headers: {
      authorization: '<redacted>',
    },
    json: {
      password: '<redacted>',
    },
  });
});

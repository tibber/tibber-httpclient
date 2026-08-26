import { Response } from 'got/dist/source';
import { pinoSerializers } from './log-serializers';

const { req, res } = pinoSerializers.bidirectional;

describe('pinoSerializers', () => {
  it('should redact credentials from a failed request', () => {
    const serialized = JSON.stringify(
      req({
        failed: true,
        method: 'POST',
        url: 'https://api.example.com/v1/things?key=google-api-key-value&page=2',
        headers: { authorization: 'Bearer super-secret-token', cookie: 'session=super-secret-session' },
        json: { password: 'super-secret-password', name: 'keep-me' },
      }),
    );

    expect(serialized).not.toContain('super-secret-token');
    expect(serialized).not.toContain('super-secret-session');
    expect(serialized).not.toContain('super-secret-password');
    expect(serialized).not.toContain('google-api-key-value');
    expect(serialized).toContain('page=2');
    expect(serialized).toContain('keep-me');
  });

  it('should redact set-cookie from a failed response', () => {
    const serialized = JSON.stringify(
      res({
        failed: true,
        statusCode: 401,
        headers: { 'set-cookie': 'session=super-secret-session', 'content-type': 'application/json' },
        body: 'Unauthorized',
      } as unknown as Response & { failed: boolean }),
    );

    expect(serialized).not.toContain('super-secret-session');
    expect(serialized).toContain('application/json');
  });
});

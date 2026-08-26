import { pinoSerializers } from './log-serializers';

const { req } = pinoSerializers.bidirectional;

describe('pinoSerializers', () => {
  it('should redact credentials from a failed request', () => {
    const serialized = JSON.stringify(
      req({
        failed: true,
        method: 'POST',
        url: 'https://api.example.com/v1/things?key=google-api-key-value&page=2',
        headers: { authorization: 'Bearer super-secret-token', cookie: 'session=super-secret-session', 'x-api-key': 'super-secret-api-key' },
        json: { password: 'super-secret-password', name: 'keep-me' },
      }),
    );

    expect(serialized).not.toContain('super-secret-token');
    expect(serialized).not.toContain('super-secret-session');
    expect(serialized).not.toContain('super-secret-api-key');
    expect(serialized).not.toContain('super-secret-password');
    expect(serialized).not.toContain('google-api-key-value');
    expect(serialized).toContain('/v1/things');
    expect(serialized).toContain('keep-me');
  });
});

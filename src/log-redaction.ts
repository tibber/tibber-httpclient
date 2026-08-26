export const genericLogRedactionKeyPatterns = {
  headers: [/authorization/i, /cookie/i],
  props: [/pass(word)?/i, /email/i, /token/i, /secret/i, /client_?id/i, /client_?secret/i, /user(name)?/i],
  query: [/^key$/i, /api[_-]?key/i, /access[_-]?key/i, /pass(word)?/i, /token/i, /secret/i, /signature/i, /^sig$/i],
};

export const pinoLogRedactionKeyPaths = [
  'req.*.authorization',
  'req.*.Authorization',
  'req.*.email',
  'req.*.Email',
  'req.*.pass',
  'req.*.Pass',
  'req.*.password',
  'req.*.Password',
  'req.*.token',
  'req.*.Token',
  'req.*.user',
  'req.*.User',
  'req.*.username',
  'req.*.Username',
  'req.*.clientId',
  'req.*.ClientId',
  'req.*.client_id',
  'req.*.clientSecret',
  'req.*.ClientSecret',
  'req.*.client_secret',
];

export const redactUrl = (url: unknown): string | undefined => {
  if (!url) return undefined;
  try {
    const parsed = new URL(String(url));
    if (parsed.username) parsed.username = 'redacted';
    if (parsed.password) parsed.password = 'redacted';
    for (const key of [...parsed.searchParams.keys()]) {
      if (genericLogRedactionKeyPatterns.query.some((pattern) => pattern.test(key))) {
        parsed.searchParams.set(key, 'redacted');
      }
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
};

export const redactRecordKeys = <T extends object>(record: T | undefined, patterns: RegExp[]): T | undefined => {
  if (!record) return record;
  const result = { ...record } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (patterns.some((pattern) => pattern.test(key))) result[key] = '<redacted>';
  }
  return result as T;
};

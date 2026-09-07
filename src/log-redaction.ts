export const genericLogRedactionKeyPatterns = {
  headers: [/authorization/i, /cookie/i, /token/i, /secret/i, /api[-_]?key/i],
  props: [/pass(word)?/i, /email/i, /token/i, /secret/i, /client_?id/i, /client_?secret/i, /user(name)?/i],
};

export const pinoLogRedactionKeyPaths = [
  'req.*.authorization',
  'req.*.Authorization',
  'req.*.cookie',
  'req.*.Cookie',
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
  return String(url)
    .split(/[?#]/)[0]
    .replace(/^((?:[a-z][\w+.-]*:)?\/\/)[^/]*@/i, '$1');
};

export const redactRecordKeys = <T>(record: T, patterns: RegExp[]): T => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const result = { ...record } as Record<string, unknown>;
  for (const key of Object.keys(result)) if (patterns.some((pattern) => pattern.test(key))) result[key] = '<redacted>';
  return result as T;
};

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

const secretQueryParams = [...genericLogRedactionKeyPatterns.props, /^key$/i, /api[_-]?key/i, /signature/i];

const matchesAny = (patterns: RegExp[], key: string) => patterns.some((pattern) => pattern.test(key));

export const redactUrl = (url: unknown): string | undefined => {
  if (!url) return undefined;
  try {
    const parsed = new URL(String(url));
    if (parsed.username) parsed.username = 'redacted';
    if (parsed.password) parsed.password = 'redacted';
    for (const key of parsed.searchParams.keys()) {
      if (matchesAny(secretQueryParams, key)) parsed.searchParams.set(key, 'redacted');
    }
    return parsed.toString();
  } catch {
    return '<unparseable-url>';
  }
};

export const redactInPlace = (record: Record<string, unknown> | undefined, patterns: RegExp[]): void => {
  if (!record) return;
  for (const key of Object.keys(record)) {
    // eslint-disable-next-line no-param-reassign
    if (matchesAny(patterns, key)) record[key] = '<redacted>';
  }
};

export const redactRecordKeys = (record: Record<string, unknown> | undefined, patterns: RegExp[]) => {
  if (!record) return record;
  const result = { ...record };
  redactInPlace(result, patterns);
  return result;
};

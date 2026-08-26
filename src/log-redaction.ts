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
  try {
    const asString = String(url);
    if (!/[?#@]/.test(asString)) return asString;
    const { protocol, host, pathname } = new URL(asString);
    return `${protocol}//${host}${pathname}`;
  } catch {
    return '<unparseable-url>';
  }
};

export const redactInPlace = (record: Record<string, unknown> | undefined, patterns: RegExp[]): void => {
  if (!record) return;
  for (const key of Object.keys(record)) {
    // eslint-disable-next-line no-param-reassign
    if (patterns.some((pattern) => pattern.test(key))) record[key] = '<redacted>';
  }
};

export const redactRecordKeys = (record: Record<string, unknown> | undefined, patterns: RegExp[]) => {
  if (!record) return record;
  const result = { ...record };
  redactInPlace(result, patterns);
  return result;
};

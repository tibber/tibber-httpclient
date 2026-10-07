export const genericLogRedactionKeyPatterns = {
  headers: [/authorization/i, /cookie/i, /api[-_]?key/i, /token/i, /secret/i, /^x-auth/i, /session/i],
  props: [/pass(word)?/i, /email/i, /token/i, /secret/i, /client_?id/i, /client_?secret/i, /user(name)?/i],
  // anchored where possible, so harmless params like `passengers` or `author` stay readable
  query: [
    /token/i,
    /secret/i,
    /pass(word|wd)?$/i,
    /signature/i,
    /^sig$/i,
    /credential/i,
    /api[-_]?key/i,
    /^key$/i,
    /^code$/i,
    /jwt/i,
    /^auth(orization)?$/i,
    /session/i,
    /e-?mail/i,
  ],
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

/**
 * Masks credentials embedded in a URL (userinfo and sensitive query parameter values).
 * Works on absolute as well as relative URLs.
 */
export const redactUrl = (url: string): string => {
  if (!url.includes('?') && !url.includes('@')) return url;
  return url
    .replace(/\/\/[^/?#@\s]*@/, '//<redacted>@')
    .replace(/([?&])([^=&#]+)=([^&#]*)/g, (match, separator: string, key: string) =>
      genericLogRedactionKeyPatterns.query.some((pattern) => pattern.test(key))
        ? `${separator}${key}=<redacted>`
        : match,
    );
};

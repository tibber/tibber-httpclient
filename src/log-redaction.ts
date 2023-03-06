export const genericLogRedactionKeyPatterns = {
  headers: [/authorization/i],
  props: [/pass(word)?/i, /email/i, /token/i, /secret/i, /client_?id/i, /client_?secret/i, /user(name)?/i],
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

# tibber-httpclient

[![Backstage](https://img.shields.io/badge/Backstage-catalog-9BF0E1?logo=backstage 'Backstage')](https://tibber.roadie.so/catalog/default/component/tibber-httpclient)
[![CircleCI](https://img.shields.io/badge/CircleCI-pipelines-343434?logo=circleci 'CircleCI')](https://circleci.com/gh/tibber/tibber-httpclient)

Http client that is based upon `got` library.

## Installing

The package is published to GitHub Packages as `@tibber/tibber-httpclient`. Versions up to 5.4.1 were also published to npmjs as `tibber-httpclient`; npmjs gets no new versions.

Point the `@tibber` scope at GitHub Packages in the consuming repo's `.npmrc`:

```
@tibber:registry=https://npm.pkg.github.com
```

Installing needs a token that can read the org's packages. CircleCI appends it before `yarn install` (`echo "//npm.pkg.github.com/:_authToken=$GITHUB_READONLY_PACKAGES" >> .npmrc`), and Docker builds get it as a build secret, as in `service-template`.

To move off the npmjs package without touching imports, install it under the old name with an alias:

```json
"tibber-httpclient": "npm:@tibber/tibber-httpclient@^5"
```

New code can depend on `@tibber/tibber-httpclient` directly and import from it.

The v1 version of this library used the deprecated `request-promise` library.

The v2 version was updated to use the more actively developed `got` under the hood instead.

With `got` there is now also support for cancelling requests.

The v5 version no longer bundles its runtime dependencies (`got`, `fast-copy`) into `dist`. They are resolved from `node_modules`, so security scanners see them and consumers can patch them via `resolutions`/`overrides`. Since `got` is ESM-only, this requires Node.js `^20.19.0 || >=22.12.0` (`require(esm)` support). Consumers that load this package in Jest must allow `got` and its dependencies to be transformed (see `jest.config.js`).

Since 5.3, requests time out after 59 seconds by default, the same as the .NET `Tibber.Services.Client`. The timeout covers reading the whole body, including `stream`. Override it per client with `options: { timeout: { request: ms } }`, or per request with `{ timeout: { request: ms } }`.

Since 5.4, the pooled connection lifetime is configurable with `pooledConnectionLifetime` (milliseconds), defaulting to 60 seconds.

See the unit tests for how to use this library.

All options that can be supplied to instantiation or the HTTP requests are fully compatible with the `got` API.

## Interfacing with Pino logging

The v3.x version has support for [Pino](https://github.com/pinojs/pino).

The library has as few opinions as possible as to how the logging should be formatted or serialized,

opting to delegate those decisions to the actual service/application.

However, the library exports some default serializers and redaction keys you can use, if you want. 

### Serializers

Example of an ExpressJS service using this library + Pino:

```ts
// logger-middleware.ts
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { serializers } from '@tibber/tibber-httpclient';
//       ^^^^^^^^^^^

export const requestContextLoggerMiddleware = (req, res, next) => {
  const { id: userId } = req.user ?? {};
  const httpLogger = pinoHttp({
    logger: loggerInstance.child({ userId }),
    // very important, or you will get weird results with `req`/`res` serialization
    wrapSerializers: false,
    // these are used both for incoming and outgoing requests
    serializers: {
      // you probably want this, or your custom implementation; this library does not supply one
      err: pino.stdSerializers.err,
      // these two will be used both for logging outgoing requests originating from this library 
      //   and incoming requests to your ExpressJS service 
      req: serializers.bidirectional.req,
      res: serializers.bidirectional.res,
    },
  });

  httpLogger(req, res);
  // ...
};
```

### Log redaction

Example of an ExpressJS service using this library + Pino:

```ts
// logger-middleware.ts
import { pinoHttp } from 'pino-http';
import { pinoLogRedactionKeyPaths } from '@tibber/tibber-httpclient';
//       ^^^^^^^^^^^^^^^^^^^^^^^^

export const requestContextLoggerMiddleware = (req, res, next) => {
  const { id: userId } = req.user ?? {};
  const httpLogger = pinoHttp({
    logger: loggerInstance.child({ userId }),
    // all these are case-sensitive; wildcards supported, but only at most 1
    //   cf. https://github.com/pinojs/pino/blob/master/docs/redaction.md
    redact: [
      ...pinoLogRedactionKeyPaths,
      'myRedactedKey1',
      'path.of.an.object.myRedactedKey2',
      '*.myRedactedKey3',
      'obj["hyphenated-property"].myRedactedKey4',
      'arr[*].redactedKey5InTheArrayItems',
    ],
  });

  httpLogger(req, res);
  // ...
};
```






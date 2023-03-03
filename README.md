# tibber-httpclient
Http client that is based upon `got` library.

The v1 version of this library used the deprecated `request-promise` library.

The v2 version was updated to use the more actively developer `got` under the hood instead.

With `got` there is now also support for cancelling requests.

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
import { serializers } from 'tibber-httpclient';
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
import { pinoLogRedactionKeyPaths } from 'tibber-httpclient';
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






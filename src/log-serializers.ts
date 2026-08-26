import { Response } from 'got/dist/source';
import { genericLogRedactionKeyPatterns, redactRecordKeys, redactUrl } from './log-redaction';

type FailableRequest = {
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
  json?: Record<string, unknown>;
  failed: boolean;
};

export const pinoSerializers = {
  bidirectional: {
    req: (req: FailableRequest) => {
      if (req.failed) {
        return {
          method: req.method,
          url: redactUrl(req.url),
          headers: redactRecordKeys(req.headers, genericLogRedactionKeyPatterns.headers),
          json: redactRecordKeys(req.json, genericLogRedactionKeyPatterns.props),
        };
      }

      return `${req.method} ${redactUrl(req.url)}`;
    },
    res: (res: Response & { failed: boolean }) => {
      if (res.failed) {
        return {
          statusCode: res.statusCode,
          headers: redactRecordKeys(res.headers, genericLogRedactionKeyPatterns.headers),
          body: res.body,
        };
      }

      return res.statusCode;
    },
  },
};

import { Response } from 'got/dist/source';

export const pinoSerializers = {
  bidirectional: {
    req: (req: Request & { failed: boolean }) => {
      if (req.failed) {
        return {
          method: req.method,
          url: req.url,
          headers: req.headers,
          json: req.json,
        };
      }

      return `${req.method} ${req.url}`;
    },
    res: (res: Response & { failed: boolean }) => {
      if (res.failed) {
        return {
          statusCode: res.statusCode,
          headers: res.headers,
          body: res.body,
        };
      }

      return res.statusCode;
    },
  },
};

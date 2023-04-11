import { CancelError, HTTPError, Options, Response } from 'got';
import copy from 'fast-copy';
import { genericLogRedactionKeyPatterns } from './log-redaction';

export interface Logger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface HttpLogger {
  logSuccess(response: Response, options: Options): void;
  logFailure(error: HTTPError | CancelError): void;
}

export class NoOpLogger implements HttpLogger {
  // eslint-disable-next-line class-methods-use-this
  logSuccess(_response: Response, _options: Options): void {}

  // eslint-disable-next-line class-methods-use-this
  logFailure(_error: HTTPError | CancelError): void {}
}

export class GenericLogger implements HttpLogger {
  readonly #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  logSuccess(response: Response, options: Options): void {
    const { url, statusCode, timings } = response;
    const message = `${options.method} ${url} ${statusCode} ${new Date().getTime() - timings.start} ms`;
    if (options.method === 'GET') {
      this.#logger.debug(message);
    } else {
      this.#logger.info(message);
    }
    const redactedOptions = redact(options);
    this.#logger.debug('request-options', JSON.stringify(redactedOptions).replace(/\\n/g, ''));
  }

  logFailure(error: HTTPError | CancelError): void {
    const { context, headers, method } = error.options;
    const { requestUrl } = error.request ?? {};
    const code = error.response?.statusCode ?? error.code;
    const { start, end, error: err } = error?.timings ?? {};
    const duration = err && end && start ? (err ?? end) - start : undefined;

    const redactedOptions = redact(error.options);
    this.#logger.error(
      '\n' +
        '--------------------------------------------------------------------\n' +
        `${method} ${requestUrl} ${code ?? 'unknown statusCode'} (${duration ?? ' - '} ms)\n` +
        `headers: ${JSON.stringify(headers)}\n` +
        `request-options: ${JSON.stringify({ ...redactedOptions, context }).replace(/\\n/g, '')}\n` +
        `error:${error.message}\n` +
        `stack:${error.stack}\n` +
        '--------------------------------------------------------------------',
    );
  }
}

export class PinoLogger implements HttpLogger {
  readonly #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  logSuccess(res: Response): void {
    const { request: req, timings } = res;
    const level = req.options.method === 'GET' ? 'debug' : 'info';
    this.#logger[level]({
      req: {
        method: req.options?.method,
        url: req.options?.url,
      },
      res: {
        statusCode: res.statusCode,
      },
      responseTime: Number(timings?.end) - Number(timings?.start),
    });
  }

  logFailure(error: HTTPError | CancelError): void {
    const { response: res, request: req, options, timings } = error;
    this.#logger.error({
      req: {
        method: req?.options?.method,
        url: req?.options?.url,
        headers: options.headers,
        json: options.json,
        failed: true,
      },
      res: {
        statusCode: res.statusCode,
        headers: res.headers,
        body: res.body,
        failed: true,
      },
      err: error,
      responseTime: Number(timings?.end) - Number(timings?.start),
    });
  }
}

export const redact = (options: Options) => {
  const clone = copy(options);
  redactSensitiveHeaders(clone);
  redactSensitiveProps(clone);
  return clone;
};

export const redactSensitiveHeaders = (options: Options) => {
  if (options.headers === undefined) return;

  for (const prop of Object.keys(options.headers ?? {})) {
    for (const propMatch of genericLogRedactionKeyPatterns.headers) {
      if (!propMatch.test(prop)) continue;
      // eslint-disable-next-line no-param-reassign
      options.headers[prop] = '<redacted>';
    }
  }
};

export const redactSensitiveProps = (options: Options) => {
  const jsonOrForm = options.json ?? options.form;
  if (jsonOrForm === undefined) return;

  for (const prop of Object.keys(jsonOrForm)) {
    for (const propMatch of genericLogRedactionKeyPatterns.props) {
      if (!propMatch.test(prop)) continue;
      jsonOrForm[prop] = '<redacted>';
    }
  }
};

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
    const { request, timings } = res;
    const level = request.options.method === 'GET' ? 'debug' : 'info';
    const req = copy(request);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    (req as any).method = req.options?.method;
    (req as any).url = req.options?.url;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    this.#logger[level]({
      req,
      res,
      responseTime: Number(timings?.end) - Number(timings?.start),
    });
  }

  logFailure(error: HTTPError | CancelError): void {
    const { response, request, options, timings } = error;
    const req = copy(request);
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (req as any).method = req?.options?.method;
    (req as any).url = req?.options?.url;
    (req as any).headers = options.headers;
    (req as any).json = options.json;
    (req as any).failed = true;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const res = copy(response);
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (res as any).failed = true;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    this.#logger.error({
      req,
      res,
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

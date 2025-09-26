import { CancelError, HTTPError, Response } from 'got/dist/source';
import copy from 'fast-copy';
import { genericLogRedactionKeyPatterns } from './log-redaction';
import { HttpLogger, Logger, RequestOptions } from './interfaces';

export class NoOpLogger implements HttpLogger {
  // eslint-disable-next-line class-methods-use-this
  logSuccess(_response: Response, _options: RequestOptions): void {}

  // eslint-disable-next-line class-methods-use-this
  logFailure(_error: HTTPError | CancelError): void {}
}

const tryStringifyJSON = (data: object | undefined | null, onfailureResult?: string): string=>{
  if (!data){
    return '';
  }
  try {
    return JSON.stringify(data);
  }
  catch (e) {
    return onfailureResult ?? 'could not serialize logged data';
  }
}


export class GenericLogger implements HttpLogger {
  readonly #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  logSuccess(response: Response, options: RequestOptions): void {
    const { url, statusCode, timings } = response;
    const message = `${options.method} ${url} ${statusCode} ${new Date().getTime() - timings.start} ms`;
    if (options.method === 'GET') {
      this.#logger.debug({}, message);
    } else {
      this.#logger.info({}, message);
    }
    const redactedOptions = redact(options);
    this.#logger.debug({ requestOptions: redactedOptions }, 'request-options');
  }

  logFailure(error: HTTPError | CancelError): void {
    const { context, headers, method } = error.options;
    const { requestUrl } = error.request ?? {};
    const code = error.response?.statusCode ?? error.code;
    const { start, end, error: err } = error?.timings ?? {};
    const duration = err && end && start ? (err ?? end) - start : undefined;

    const redactedOptions = redact(error.options);
    this.#logger.error(
      {},
      '\n' +
        '--------------------------------------------------------------------\n' +
        `${method} ${requestUrl} ${code ?? 'unknown statusCode'} (${duration ?? ' - '} ms)\n` +
        `headers: ${tryStringifyJSON(headers)}\n` +
        `request-options: ${tryStringifyJSON({ ...redactedOptions, context }).replace(/\\n/g, '')}\n` +
        `error: ${error.message}\n` +
        `stack: ${error.stack}\n` +
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

export const redact = (options: RequestOptions) => {
  const clone = copy(options);
  redactSensitiveHeaders(clone);
  redactSensitiveProps(clone);
  return clone;
};

export const redactSensitiveHeaders = (options: RequestOptions) => {
  if (options.headers === undefined) return;

  for (const prop of Object.keys(options.headers ?? {})) {
    for (const propMatch of genericLogRedactionKeyPatterns.headers) {
      if (!propMatch.test(prop)) continue;
      // eslint-disable-next-line no-param-reassign
      options.headers[prop] = '<redacted>';
    }
  }
};

export const redactSensitiveProps = (options: RequestOptions) => {
  const jsonOrForm = options.json ?? options.form;
  if (jsonOrForm === undefined) return;

  for (const prop of Object.keys(jsonOrForm)) {
    for (const propMatch of genericLogRedactionKeyPatterns.props) {
      if (!propMatch.test(prop)) continue;
      (jsonOrForm as Record<string, unknown>)[prop] = '<redacted>';
    }
  }
};

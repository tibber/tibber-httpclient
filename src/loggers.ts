import { RequestError, Response } from 'got/dist/source';
import copy from 'fast-copy';
import { genericLogRedactionKeyPatterns } from './log-redaction';
import { HttpLogger, Logger, RequestOptions } from './interfaces';

export class NoOpLogger implements HttpLogger {
  // eslint-disable-next-line class-methods-use-this
  logSuccess(_response: Response, _options: RequestOptions): void {}

  // eslint-disable-next-line class-methods-use-this
  logFailure(_error: RequestError): void {}
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
      this.#logger.debug(message);
    } else {
      this.#logger.info(message);
    }
    const redactedOptions = redact(options);
    this.#logger.debug('request-options', tryStringifyJSON(redactedOptions).replace(/\\n/g, ''));
  }

  logFailure(error: RequestError): void {
    const { context, headers, method } = error.options;
    const requestUrl = error.request?.requestUrl ?? error.options.url;
    const code = error.response?.statusCode ?? error.code;
    const { start, end, error: err } = error?.timings ?? {};
    const duration = err && end && start ? (err ?? end) - start : undefined;

    const redactedOptions = redact(error.options);
    this.#logger.error(
      '\n' +
        '--------------------------------------------------------------------\n' +
        `${method} ${requestUrl} ${code ?? 'unknown statusCode'} (${duration ?? ' - '} ms)\n` +
        `headers: ${tryStringifyJSON(headers)}\n` +
        `request-options: ${tryStringifyJSON({ ...redactedOptions, context }).replace(/\\n/g, '')}\n` +
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
    const responseTime = Number(timings?.end) - Number(timings?.start);
    const message = `${req.options.method} ${req.options.url} ${res.statusCode} ${res.statusMessage} ${responseTime}ms`;
    this.#logger[level]({
      req: {
        method: req.options?.method,
        url: req.options?.url,
      },
      res: {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
      },
      responseTime,
    }, message);
  }

  logFailure(error: RequestError): void {
    const { response: res, request: req, timings } = error;
    // requests that never connect have no request/response/timings — fall back to
    // the always-present options so the message never interpolates undefined
    const method = req?.options?.method ?? error.options.method;
    const url = req?.options?.url ?? error.options.url;
    const responseTimeMs = Number(timings?.end) - Number(timings?.start);
    const responseTime = Number.isNaN(responseTimeMs) ? undefined : responseTimeMs;
    const statusCode = res?.statusCode ?? error.code;
    const statusMessage = res?.statusMessage ?? error.name;
    const message = `${method} ${url} ${statusCode} ${statusMessage}${responseTime === undefined ? '' : ` ${responseTime}ms`}`;
    this.#logger.error({
      req: {
        method,
        url,
        failed: true,
      },
      res: {
        statusCode: res?.statusCode,
        statusMessage: res?.statusMessage,
        failed: true,
      },
      err: {
        message: error.message,
        code: error.code,
        statusCode: res?.statusCode,
      },
      responseTime,
    }, message);
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

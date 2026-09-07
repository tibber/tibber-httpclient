import { RequestError, Response } from 'got/dist/source';
import { genericLogRedactionKeyPatterns, redactRecordKeys, redactUrl } from './log-redaction';
import { HttpLogger, Logger, RequestOptions } from './interfaces';

export class NoOpLogger implements HttpLogger {
  // eslint-disable-next-line class-methods-use-this
  logSuccess(_response: Response, _options: RequestOptions): void {}

  // eslint-disable-next-line class-methods-use-this
  logFailure(_error: RequestError): void {}
}

const tryStringifyJSON = (data: object | undefined | null): string => {
  if (!data) return '';
  try {
    return JSON.stringify(data).replace(/\\n/g, '');
  } catch {
    return 'could not serialize logged data';
  }
};

export class GenericLogger implements HttpLogger {
  readonly #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  logSuccess(response: Response, options: RequestOptions): void {
    const { url, statusCode, timings } = response;
    const message = `${options.method} ${redactUrl(url)} ${statusCode} ${new Date().getTime() - timings.start} ms`;
    this.#logger[options.method === 'GET' ? 'debug' : 'info'](message);
    this.#logger.debug('request-options', tryStringifyJSON(redact(options)));
  }

  logFailure(error: RequestError): void {
    const { context, method, url, headers, json, form } = error.options;
    const requestUrl = redactUrl(error.request?.requestUrl ?? url);
    const code = error.response?.statusCode ?? error.code;
    const { start, end, error: err } = error?.timings ?? {};
    const duration = err && end && start ? (err ?? end) - start : undefined;
    const { headers: headerPatterns, props: propPatterns } = genericLogRedactionKeyPatterns;

    this.#logger.error(
      '\n' +
        '--------------------------------------------------------------------\n' +
        `${method} ${requestUrl} ${code ?? 'unknown statusCode'} (${duration ?? ' - '} ms)\n` +
        `headers: ${tryStringifyJSON(redactRecordKeys(headers, headerPatterns))}\n` +
        `request-options: ${tryStringifyJSON({
          body: redactRecordKeys(json ?? form, propPatterns),
          context: redactRecordKeys(context, propPatterns),
        })}\n` +
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
    const url = redactUrl(req.options?.url);
    const message = `${req.options.method} ${url} ${res.statusCode} ${res.statusMessage} ${responseTime}ms`;
    this.#logger[level]({
      req: {
        method: req.options?.method,
        url,
      },
      res: {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
      },
      responseTime,
    }, message);
  }

  logFailure(error: RequestError): void {
    const { response: res, timings } = error;
    // connection-level failures have no response/timings, but options is always set
    const { method } = error.options;
    const url = redactUrl(error.options.url);
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

export const redact = (options: RequestOptions) => ({
  ...options,
  headers: redactRecordKeys(options.headers, genericLogRedactionKeyPatterns.headers),
  json: redactRecordKeys(options.json, genericLogRedactionKeyPatterns.props),
  form: redactRecordKeys(options.form, genericLogRedactionKeyPatterns.props),
  context: redactRecordKeys(options.context, genericLogRedactionKeyPatterns.props),
});

/* eslint-disable no-param-reassign */
export const redactSensitiveHeaders = (options: RequestOptions) => {
  options.headers = redactRecordKeys(options.headers, genericLogRedactionKeyPatterns.headers);
};

export const redactSensitiveProps = (options: RequestOptions) => {
  if (options.json) options.json = redactRecordKeys(options.json, genericLogRedactionKeyPatterns.props);
  if (options.form) options.form = redactRecordKeys(options.form, genericLogRedactionKeyPatterns.props);
};

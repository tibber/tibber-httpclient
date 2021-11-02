/* eslint-disable require-jsdoc */
import got, { Response, Got, Options, CancelableRequest, HTTPError, CancelError } from 'got/dist/source';
import { AbortSignal } from 'abort-controller';

type GotOptions = Pick<Options, 'method' | 'timeout' | 'decompress' | 'json' | 'retry'>;
interface RequestOptions extends GotOptions {
  abortSignal?: AbortSignal;
}

export interface IHttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<T>;
  put<T>(path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<T>;
  delete(path: string, payload?: Record<string, unknown>, options?: RequestOptions): Promise<void>;
}

export interface Logger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface HttpClientContext {
  [key: string]: string | Logger | undefined;
  basicAuthUserName?: string;
  basicAuthPassword?: string;
  bearerToken?: string;
  logger?: Logger;
}

export interface HttpClientConfiguration {
  prefixUrl: string;
  context?: HttpClientContext;
  requestOptions?: Options;
}

export class RequestException extends Error {
  public code;
  public stack;
  public inner;
  constructor({
    message,
    statusCode,
    innerError,
    stack
  }: {
    message: string;
    statusCode: string | number;
    innerError: Error;
    stack?: string;
  }) {
    super(message);
    this.code = statusCode;
    this.stack = stack;
    this.inner = innerError;
  }
}

/**
 * HttpClient to make network requests
 */
export class HttpClient implements IHttpClient {
  private _got: Got;
  private _logger: Logger;
  private _prefixUrl: string;

  constructor(config: HttpClientConfiguration) {
    const options: Options = { ...config };

    const addToHeader = (header: Record<string, string>) => {
      options.headers ? Object.assign(options.headers, header) : (options.headers = header);
    };

    // default authorization header
    if (options.context?.basicAuthUserName && options.context?.basicAuthPassword) {
      addToHeader({
        Authorization: `Basic ${Buffer.from(
          options.context.basicAuthUserName + ':' + options.context.basicAuthPassword
        ).toString('base64')}`
      });
    } else if (options.context?.bearerToken) {
      addToHeader({ Authorization: 'Bearer ' + options.context.bearer });
    }

    // ininitialize logger
    if (config?.context?.logger) {
      this._logger = config.context.logger;
      delete config.context.logger;
    } else {
      this._logger = console;
    }

    // save prefixUrl
    this._prefixUrl = config.prefixUrl;

    // initialize got and extend it with default options
    this._got = got.extend({ ...options, retry: 0 });
  }

  private _request(path: string, options: RequestOptions): CancelableRequest<Response<string>> {
    const { abortSignal, ...gotOptions } = options || {};
    const sanitizedPath = path.startsWith('/') ? path.slice(1) : path;
    const responsePromise = this.got(sanitizedPath, { ...gotOptions });

    if (abortSignal) {
      abortSignal &&
        abortSignal.addEventListener('abort', () => {
          responsePromise.cancel();
        });
    }
    return responsePromise;
  }

  private async _requestJson<T>({ path, options }: { path: string; options: RequestOptions }): Promise<T> {
    try {
      const responsePromise = this._request(path, options);
      const [response, json] = await Promise.all([responsePromise, responsePromise.json<T>()]);

      this._logger?.info(
        `${options.method} ${response.url} ${response.statusCode} ${new Date().getTime() - response.timings.start} ms`
      );
      this._logger?.debug('request-options', JSON.stringify(options).replace(/\\n/g, ''));
      return json;
    } catch (error) {
      const { context, headers, method } = error.options;
      const duration = (error.timings?.error || error.timings.end) - error.timings?.start;
      const code = error.response?.statusCode || error.code;

      if (error instanceof HTTPError || error instanceof CancelError) {
        this._logger.error(
          '\n' +
            '--------------------------------------------------------------------\n' +
            `${method} ${this._prefixUrl}${path} ${code || 'unkown statusCode'} (${duration ? duration : ' - '} ms)\n` +
            `headers: ${JSON.stringify(headers)}\n` +
            `request-options: ${JSON.stringify({ ...options, context }).replace(/\\n/g, '')}\n` +
            `error:${error.message}\n` +
            `stack:${error.stack}\n` +
            '--------------------------------------------------------------------'
        );
      }
      throw new RequestException({ message: error.message, statusCode: code, innerError: error, stack: error?.stack });
    }
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this._requestJson({
      path: path,
      options: { ...options, method: 'GET' }
    });
  }
  async post<T>(path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    return this._requestJson({
      path: path,
      options: { ...options, method: 'POST', json: payload }
    });
  }
  async put<T>(path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    return this._requestJson({
      path: path,
      options: { ...options, method: 'PUT', json: payload }
    });
  }
  async patch<T>(path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    return this._requestJson({
      path: path,
      options: { ...options, method: 'PATCH', json: payload }
    });
  }
  async delete(path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<void> {
    await this._requestJson({
      path: path,
      options: { ...options, method: 'DELETE', json: payload }
    });
    return void 0;
  }

  get got(): Got {
    return this._got;
  }
}

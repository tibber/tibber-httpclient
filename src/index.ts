/* eslint-disable require-jsdoc */
import got, { Response, Got, Options, CancelableRequest, HTTPError, CancelError } from 'got/dist/source';
import { AbortSignal } from 'abort-controller';

type GotOptions = Pick<Options, 'method' | 'timeout' | 'decompress' | 'json' | 'retry' | 'headers'>;
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

export interface HttpClientConfig {
  basicAuthUserName?: string;
  basicAuthPassword?: string;
  bearerToken?: string;
}

export class RequestException extends Error {
  code;
  stack;
  inner;
  constructor({
    message,
    statusCode,
    innerError,
    stack
  }: {
    message: string;
    statusCode?: string | number;
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
  got: Got;
  logger: Logger | undefined;
  prefixUrl: string;

  constructor({
    prefixUrl,
    logger,
    config,
    options
  }: {
    prefixUrl: string;
    logger?: Logger;
    config?: HttpClientConfig;
    options?: Options;
  }) {
    // initialize all default options for this client
    const gotOptions: Options = {
      retry: 0,
      ...options,
      context: { ...options?.context, ...config },
      prefixUrl: prefixUrl
    };

    const addToHeader = (header: Record<string, string>) => {
      gotOptions.headers ??= header;
      gotOptions.headers = { ...gotOptions.headers, ...header };
    };

    // assemble default authorization header
    if (config?.basicAuthUserName && config?.basicAuthPassword) {
      addToHeader({
        Authorization: `Basic ${Buffer.from(config.basicAuthUserName + ':' + config.basicAuthPassword).toString(
          'base64'
        )}`
      });
    } else if (config?.bearerToken) {
      addToHeader({ Authorization: 'Bearer ' + config.bearerToken });
    }

    // initialize logger
    if (logger) {
      this.logger = logger;
    }

    // save prefixUrl
    this.prefixUrl = prefixUrl;

    // initialize got and extend it with default options
    this.got = got.extend(gotOptions);
  }

  #request(path: string, options: RequestOptions): CancelableRequest<Response<string>> {
    const { abortSignal, ...gotOptions } = options ?? {};
    const sanitizedPath = path.startsWith('/') ? path.slice(1) : path;
    const responsePromise = this.got(sanitizedPath, { ...gotOptions });

    abortSignal &&
      abortSignal.addEventListener('abort', () => {
        responsePromise.cancel();
      });

    return responsePromise;
  }

  async #requestJson<T>({ path, options }: { path: string; options: RequestOptions }): Promise<T> {
    try {
      const responsePromise = this.#request(path, options);
      const [{ url, statusCode, timings }, json] = await Promise.all([responsePromise, responsePromise.json<T>()]);

      this.logger?.info(`${options.method} ${url} ${statusCode} ${new Date().getTime() - timings.start} ms`);
      this.logger?.debug('request-options', JSON.stringify(options).replace(/\\n/g, ''));
      return json;
    } catch (error) {
      throw this.#logAndThrowError({ error, path, options });
    }
  }

  #logAndThrowError({ error, path, options }: { error: unknown; path: string; options: Options }) {
    let code;
    if (error instanceof HTTPError || error instanceof CancelError) {
      const { context, headers, method } = error.options;
      const { start, end, error: err } = error?.timings ?? {};
      const duration = err && end && start && (err ?? end) - start;
      code = error.response?.statusCode ?? error.code;

      this.logger?.error(
        '\n' +
          '--------------------------------------------------------------------\n' +
          `${method} ${this.prefixUrl}${path} ${code ?? 'unknown statusCode'} (${duration ?? ' - '} ms)\n` +
          `headers: ${JSON.stringify(headers)}\n` +
          `request-options: ${JSON.stringify({ ...options, context }).replace(/\\n/g, '')}\n` +
          `error:${error.message}\n` +
          `stack:${error.stack}\n` +
          '--------------------------------------------------------------------'
      );
    }
    if (error instanceof Error) {
      return new RequestException({
        message: error.message,
        statusCode: code,
        innerError: error,
        stack: error?.stack
      });
    }

    return error;
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.#requestJson({
      path: path,
      options: { ...options, method: 'GET' }
    });
  }
  async post<T>(path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    return this.#requestJson({
      path: path,
      options: { ...options, method: 'POST', json: payload }
    });
  }
  async put<T>(path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    return this.#requestJson({
      path: path,
      options: { ...options, method: 'PUT', json: payload }
    });
  }
  async patch<T>(path: string, payload: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    return this.#requestJson({
      path: path,
      options: { ...options, method: 'PATCH', json: payload }
    });
  }
  async delete(path: string, payload?: Record<string, unknown>, options?: RequestOptions): Promise<void> {
    await this.#requestJson({
      path: path,
      options: { ...options, method: 'DELETE', json: payload }
    });
    return undefined;
  }
}



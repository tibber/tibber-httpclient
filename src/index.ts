/* eslint-disable require-jsdoc */
import got, { Response, Got, Options, CancelableRequest, HTTPError, CancelError } from 'got/dist/source';
import { AbortSignal } from 'abort-controller';
import NodeCache from 'node-cache';

type GotOptions = Pick<Options, 'method' | 'timeout' | 'decompress' | 'json' | 'retry' | 'headers' | 'form' | 'followRedirect'>;
interface RequestOptions extends GotOptions{
  abortSignal?: AbortSignal;
}

export interface IHttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, options?: RequestOptions): Promise<T>;
  put<T>(path: string, options?: RequestOptions): Promise<T>;
  delete(path: string, options?: RequestOptions): Promise<void>;
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

type HttpClientInitParams = {
  prefixUrl?: string;
  logger?: Logger;
  config?: HttpClientConfig;
  options?: Options;
}

/**
 * HttpClient to make network requests
 */
export class HttpClient implements IHttpClient {
  got: Got;
  logger: Logger | undefined;
  prefixUrl: string | undefined;

  constructor(initParams?: HttpClientInitParams) {
    const addToHeader = (header: Record<string, string>) => {
      gotOptions.headers ??= header;
      gotOptions.headers = { ...gotOptions.headers, ...header };
    };

    // initialize all default options for this client
    const gotOptions: Options = {
      retry: 0,
      ...initParams?.options,
      context: { ...initParams?.options?.context, ...initParams?.config },
      prefixUrl: initParams?.prefixUrl
    };

    // assemble default authorization header
    if (initParams?.config?.basicAuthUserName && initParams?.config?.basicAuthPassword) {
      addToHeader({
        Authorization: `Basic ${Buffer.from(initParams?.config.basicAuthUserName + ':' + initParams?.config.basicAuthPassword).toString(
          'base64'
        )}`
      });
    } else if (initParams?.config?.bearerToken) {
      addToHeader({ Authorization: 'Bearer ' + initParams?.config.bearerToken });
    }

    // initialize logger
    if (initParams?.logger) {
      this.logger = initParams?.logger;
    }

    // save prefixUrl
    this.prefixUrl = initParams?.prefixUrl;

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
  async post<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.#requestJson({
      path: path,
      options: { ...options, method: 'POST' }
    });
  }
  async put<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.#requestJson({
      path: path,
      options: { ...options, method: 'PUT'}
    });
  }
  async patch<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.#requestJson({
      path: path,
      options: { ...options, method: 'PATCH'}
    });
  }
  async delete(path: string, options?: RequestOptions): Promise<void> {
    await this.#requestJson({
      path: path,
      options: { ...options, method: 'DELETE'}
    });
    return undefined;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';
export class TestHttpClient implements IHttpClient {
  public _routePayloads: Record<string,Record<string, any>>
  public calls: Record<HttpMethod, Record<string, any>>

  constructor(routePayloads: Record<string,Record<HttpMethod, unknown>>) {
      this._routePayloads = routePayloads;
      this.calls = { get: {}, post: {}, patch: {}, put: {}, delete: {} };
  }

  public async get<T>(route: string): Promise<T> {
      this._routePayloads.get[route];
      return this._routePayloads.get[route];
  }

  public async post<T>(route: string, payload: any): Promise<T> {
      this.calls.post[route] = payload || {};
      return this._routePayloads.post[route];
  }

  public async put<T>(route: string, payload: any): Promise<T> {
      this.calls.put[route] = payload || {};
      return this._routePayloads.put[route];
  }

  public async patch<T>(route: string, payload: any): Promise<T> {
      this.calls.patch[route] = payload || {};
      return this._routePayloads.patch[route];
  }

  public async delete<T>(route: string): Promise<T> {
      this.calls.delete[route] = undefined;
      return this._routePayloads.delete[route];
  }
}

export interface ICachedHttpClient extends IHttpClient {
  getNoCache<T>(route: string): Promise<T>;
}
export class CachedClient implements ICachedHttpClient {
  private _httpClient: IHttpClient;
  private _logger: Logger;
  private _cache: NodeCache;
  constructor(httpClient: HttpClient, logger: Logger, cache: NodeCache) {
      this._httpClient = httpClient;
      this._logger = logger;
      this._cache = cache;
  }

  private async _get<T>(route: string, noCache: boolean): Promise<T> {

      if (!noCache) {
          const cached = this._cache.get<T>(route);
          if (cached) {
              this._logger && this._logger.info(`returning cached result for route "${route}"`);
              return cached;
          }
      }
      const result = await this._httpClient.get<T>(route);
      this._cache.set(route, result);
      return result;
  }

  public async get<T>(route: string): Promise<T> { return this._get(route, false); }
  public async getNoCache<T>(route: string): Promise<T> { return this._get(route, true); }

  public async post<T>(route: string, payload?: any): Promise<T> {
      return await this._httpClient.post<T>(route, payload);
  }

  public async put<T>(route: string, payload?: any): Promise<T> {
      return await this._httpClient.put<T>(route, payload);
  }

  public async patch<T>(route: string, payload?: any): Promise<T> {
      return await this._httpClient.patch<T>(route, payload);
  }

  public async delete(route: string): Promise<void> {
      return await this._httpClient.delete(route);
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */


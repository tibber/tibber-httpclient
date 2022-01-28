import got, { Response, Got, Options, CancelableRequest, HTTPError, CancelError, Method } from 'got/dist/source';
import { AbortSignal } from 'abort-controller';
import NodeCache from 'node-cache';

type GotOptions = Pick<
  Options,
  'method' | 'timeout' | 'decompress' | 'json' | 'retry' | 'headers' | 'form' | 'followRedirect' | 'path'
>;
interface RequestOptions extends GotOptions {
  abortSignal?: AbortSignal;
  isForm?: boolean;
}

export interface IHttpClient {
  get<T>(path: string, options?: Omit<RequestOptions, 'json'>): Promise<T>;
  post<T>(path: string, data?: Record<string, unknown>, options?: Omit<RequestOptions, 'json'>): Promise<T>;
  patch<T>(path: string, data?: Record<string, unknown>, options?: Omit<RequestOptions, 'json'>): Promise<T>;
  put<T>(path: string, data?: Record<string, unknown>, options?: Omit<RequestOptions, 'json'>): Promise<T>;
  delete(path: string, options?: Omit<RequestOptions, 'json'>): Promise<void>;
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
};
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
        Authorization: `Basic ${Buffer.from(
          `${initParams?.config.basicAuthUserName}:${initParams?.config.basicAuthPassword}`
        ).toString('base64')}`
      });
    } else if (initParams?.config?.bearerToken) {
      addToHeader({ Authorization: `Bearer ${initParams?.config.bearerToken}` });
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

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        responsePromise.cancel();
      });
    }

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
    const o = processOptions('GET', undefined, options);
    return this.#requestJson({
      path,
      options: o
    });
  }

  async post<T>(path: string, data?: Record<string, unknown>, options?: Omit<RequestOptions, 'json'>): Promise<T> {
    const o = processOptions('POST', data, options);
    return this.#requestJson({
      path,
      options: o
    });
  }

  async put<T>(path: string, data?: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    const o = processOptions('PUT', data, options);
    return this.#requestJson({
      path,
      options: o
    });
  }

  async patch<T>(path: string, data?: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    const o = processOptions('PATCH', data, options);
    return this.#requestJson({
      path,
      options: o
    });
  }

  async delete(path: string, options?: RequestOptions): Promise<void> {
    const o = processOptions('DELETE', undefined, options);
    await this.#requestJson({
      path,
      options: o
    });
    return undefined;
  }

  /**
   * @description Access to all 'got' supported options, returns the response instead of JSON.
   * @param {string} path path or url
   * @param {RequestOptions} options all options supported by 'got'
   * @return {Response<unknown>}
   */
  async raw(path: string, options: RequestOptions): Promise<Response<unknown>> {
    return this.got(path, options);
  }
}

type HttpMethodCall = 'get' | 'post' | 'put' | 'patch' | 'delete';

// this is a bug in ESLint or an issue with our ESLint setup
// eslint-disable-next-line no-unused-vars
type RoutePayloads = { [p in HttpMethodCall]?: Record<string, unknown> };

export class TestHttpClient implements IHttpClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _routePayloads: RoutePayloads;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calls: Record<HttpMethodCall, Record<string, any>>;

  constructor(routePayloads: RoutePayloads) {
    this._routePayloads = routePayloads;
    this.calls = { get: {}, post: {}, patch: {}, put: {}, delete: {} };
  }

  public async get<T>(route: string): Promise<T> {
    // storing `undefined` here makes it non-obvious to verify (you have to use the `in` keyword)
    // we don't want to potentially break people's test by changing it though
    this.calls.get[route] = undefined;
    const response = this._routePayloads.get?.[route];
    if (response === undefined) throw new Error(`GET route ${route} not found`);
    return Promise.resolve(response as T);
  }

  public async post<T>(route: string, data: Record<string, unknown>): Promise<T> {
    this.calls.post[route] = data || {};
    const response = this._routePayloads.post?.[route];
    if (response === undefined) throw new Error(`POST route ${route} not found`);
    return response as T;
  }

  public async put<T>(route: string, data: Record<string, unknown>): Promise<T> {
    this.calls.put[route] = data || {};
    const response = this._routePayloads.put?.[route];
    if (response === undefined) throw new Error(`PUT route ${route} not found`);
    return response as T;
  }

  public async patch<T>(route: string, data: Record<string, unknown>): Promise<T> {
    this.calls.patch[route] = data || {};
    const response = this._routePayloads.patch?.[route];
    if (response === undefined) throw new Error(`PATCH route ${route} not found`);
    return response as T;
  }

  public async delete<T>(route: string): Promise<T> {
    // storing `undefined` here makes it non-obvious to verify (you have to use the `in` keyword)
    // we don't want to potentially break people's test by changing it though
    this.calls.delete[route] = undefined;
    const response = this._routePayloads.delete?.[route];
    if (response === undefined) throw new Error(`DELETE route ${route} not found`);
    return response as T;
  }

  public resetCalls(): void {
    this.calls = { get: {}, post: {}, patch: {}, put: {}, delete: {} };
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
        this._logger?.info(`returning cached result for route "${route}"`);

        return cached;
      }
    }
    const result = await this._httpClient.get<T>(route);
    this._cache.set(route, result);
    return result;
  }

  public async get<T>(route: string): Promise<T> {
    return this._get(route, false);
  }

  public async getNoCache<T>(route: string): Promise<T> {
    return this._get(route, true);
  }

  public async post<T>(route: string, data?: Record<string, unknown>): Promise<T> {
    return this._httpClient.post<T>(route, data);
  }

  public async put<T>(route: string, data?: Record<string, unknown>): Promise<T> {
    return this._httpClient.put<T>(route, data);
  }

  public async patch<T>(route: string, data?: Record<string, unknown>): Promise<T> {
    return this._httpClient.patch<T>(route, data);
  }

  public async delete(route: string): Promise<void> {
    return this._httpClient.delete(route);
  }
}

// set the method and decide to place the 'json' or 'form' property, or not when no data.
const processOptions = (
  method: Method,
  data: Record<string, unknown> | undefined,
  options?: RequestOptions
): RequestOptions => {
  let jsonOrForm: string | undefined;
  if (options?.isForm) {
    jsonOrForm = 'form';
  } else if (data !== undefined && data !== null) {
    jsonOrForm = 'json';
  } else {
    jsonOrForm = undefined;
  }
  return {
    ...(options ?? {}),
    ...(jsonOrForm !== undefined ? { [jsonOrForm]: data } : {}),
    method
  };
};

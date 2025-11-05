import got, { Response, Got, CancelableRequest, HTTPError, CancelError, Method, Headers, OptionsInit } from 'got';
import NodeCache from 'node-cache';
import { HttpClientConfig, HttpLogger, IHttpClient, Logger, RequestOptions } from './interfaces';
import { GenericLogger, NoOpLogger, PinoLogger } from './loggers';

export type HeaderFunction = () => Headers;

export class RequestException extends Error {
  readonly statusCode;

  readonly stack;

  readonly innerError;

  readonly responseBody?: unknown;

  constructor({
    message,
    statusCode,
    innerError,
    stack,
    responseBody,
  }: {
    message: string;
    statusCode?: string | number;
    innerError: Error;
    stack?: string;
    responseBody?: unknown;
  }) {
    super(message);
    this.statusCode = statusCode;
    this.stack = stack;
    this.innerError = innerError;
    this.responseBody = responseBody;
  }
}

export type ProblemDetailsArgs = {
  detail?: string;
  instance?: string;
  statusCode: number;
  title: string;
  type: string;
  innerError: Error;
  extensions: {
    [k: string]: unknown;
  };
};

export class ProblemDetailsError extends RequestException {
  type: string;

  title: string;

  instance?: string;

  detail?: string;

  extensions: {
    [k: string]: unknown;
  };

  constructor(args: ProblemDetailsArgs) {
    const { detail, instance, statusCode, title, type, innerError, extensions } = args;

    super({ stack: innerError.stack, message: innerError.message, innerError, statusCode });

    this.detail = detail;
    this.type = type;
    this.instance = instance;
    this.title = title;
    this.extensions = extensions;
  }
}

export type HttpClientInitParams = {
  prefixUrl?: string;
  logger?: Logger;
  config?: HttpClientConfig;
  options?: OptionsInit;
  headerFunc?: HeaderFunction;
};

export class HttpClient implements IHttpClient {
  readonly #got: Got;

  readonly #logger: HttpLogger = new NoOpLogger();

  readonly #prefixUrl: string | undefined;

  readonly #headerFunc: HeaderFunction | undefined;

  constructor(initParams?: HttpClientInitParams) {
    const gotOptions: OptionsInit = {
      retry: {},
      ...initParams?.options,
      context: { ...initParams?.options?.context, ...initParams?.config },
    };

    if (initParams?.prefixUrl !== undefined) {
      gotOptions.prefixUrl = initParams.prefixUrl;
      this.#prefixUrl = initParams?.prefixUrl;
    }

    const addToHeader = (header: Record<string, string>) => {
      gotOptions.headers ??= header;
      gotOptions.headers = { ...gotOptions.headers, ...header };
    };

    if (initParams?.config?.basicAuthUserName && initParams?.config?.basicAuthPassword) {
      addToHeader({
        Authorization: `Basic ${Buffer.from(
          `${initParams.config.basicAuthUserName}:${initParams.config.basicAuthPassword}`,
        ).toString('base64')}`,
      });
    } else if (initParams?.config?.bearerToken) {
      addToHeader({ Authorization: `Bearer ${initParams.config.bearerToken}` });
    }

    if (initParams?.logger) {
      this.#logger =
        initParams.logger.constructor?.name === 'Pino'
          ? new PinoLogger(initParams.logger)
          : new GenericLogger(initParams.logger);
    }

    if (initParams?.headerFunc) {
      this.#headerFunc = initParams.headerFunc;
    }

    this.#got = got.extend(gotOptions);
  }

  #request(path: string, options: RequestOptions): CancelableRequest<Response<string>> {
    const { abortSignal, ...gotOptions } = options ?? {};
    const responsePromise = this.#got(path, { ...gotOptions });

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        responsePromise.cancel();
      });
    }

    return responsePromise;
  }

  async #requestJson<T>({ path, options }: { path: string; options: RequestOptions }): Promise<T> {
    const sanitizedPath = path.startsWith('/') ? path.slice(1) : path;
    try {
      const response = await this.#request(sanitizedPath, options);
      this.#logger.logSuccess(response, options);
      // Parse JSON from the response body after logging
      // This avoids keeping both the response and parsed JSON in memory simultaneously
      const json = JSON.parse(response.body) as T;
      return json;
    } catch (error) {
      throw this.#logAndCreateError({ error, path: sanitizedPath });
    }
  }

  #logAndCreateError({ error, path }: { error: unknown; path: string }) {
    let code;
    if (error instanceof HTTPError || error instanceof CancelError) {
      code = error.response?.statusCode ?? error.code;
      this.#logger.logFailure(error);
      const contentType = error.response?.headers['content-type'] ?? '';
      if (
        (contentType.includes('application/problem+json') || contentType.includes('application/json')) &&
        typeof error.response?.body === 'string'
      ) {
        try {
          const responseBody = JSON.parse(error.response.body);
          if (contentType.includes('application/json')) {
            const { message, stack } = error;
            return new RequestException({
              message: `${this.#prefixUrl}/${path} ${message}`,
              statusCode: code,
              innerError: error,
              responseBody,
              stack,
            });
          }
          const { detail, instance, title, type, ...extensions } = responseBody as {
            [k: string]: string | undefined;
          };

          if (type && title) {
            return new ProblemDetailsError({
              detail,
              instance,
              title,
              type,
              extensions: extensions ?? {},
              statusCode: code,
              innerError: error,
            });
          }
        } catch (_parsingError) {
          /* empty */
        }
      }
    }

    if (error instanceof Error) {
      const { message, stack } = error;
      return new RequestException({
        message: `${this.#prefixUrl}/${path} ${message}`,
        statusCode: code,
        innerError: error,
        stack,
      });
    }

    return error;
  }

  // set the method and decide to place the 'json' or 'form' property, or not when no data.
  #processOptions = (method: Method, data: unknown, options?: RequestOptions): RequestOptions => {
    let jsonOrForm: string | undefined;
    if (options?.isForm) {
      jsonOrForm = 'form';
    } else if (data !== undefined && data !== null) {
      jsonOrForm = 'json';
    }
    const optionsWithComputedHeaders = {
      ...options,
      headers: {
        ...options?.headers,
        ...this.#headerFunc?.(),
      },
    };

    const { isForm, ...gotOptions } = optionsWithComputedHeaders;

    return {
      ...(gotOptions ?? {}),
      ...(jsonOrForm !== undefined ? { [jsonOrForm]: data } : {}),
      method,
    };
  };

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    const opts = this.#processOptions('GET', undefined, options);
    return await this.#requestJson({
      path,
      options: opts,
    });
  }

  async post<T>(path: string, data?: unknown, options?: Omit<RequestOptions, 'json'>): Promise<T> {
    const opts = this.#processOptions('POST', data, options);
    return await this.#requestJson({
      path,
      options: opts,
    });
  }

  async put<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const opts = this.#processOptions('PUT', data, options);
    return await this.#requestJson({
      path,
      options: opts,
    });
  }

  async patch<T>(path: string, data?: unknown, options?: RequestOptions): Promise<T> {
    const opts = this.#processOptions('PATCH', data, options);
    return await this.#requestJson({
      path,
      options: opts,
    });
  }

  async delete(path: string, options?: RequestOptions, data?: unknown): Promise<void> {
    const o = this.#processOptions('DELETE', data, options);
    await this.#requestJson({
      path,
      options: o,
    });
    return undefined;
  }

  /**
   * @description Access to all 'got' supported options, returns the response instead of JSON.
   * @param {string} path path or url
   * @param {OptionsInit} options all options supported by 'got'
   * @return {Promise<Response<T = unknown>>}
   */
  async raw<T = unknown>(path: string, options: OptionsInit): Promise<Response<T>> {
    return (await this.#got(path, options)) as Response<T>;
  }
}

type HttpMethodCall = 'get' | 'post' | 'put' | 'patch' | 'delete';

type RoutePayloads = { [p in HttpMethodCall]?: Record<string, unknown> };

export class TestHttpClient implements IHttpClient {
  // tests may depend on this for verifying calls, so do not make it truly private
  _routePayloads: RoutePayloads;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calls: Record<HttpMethodCall, Record<string, any>>;

  constructor(routePayloads: RoutePayloads) {
    this._routePayloads = routePayloads;
    this.calls = { get: {}, post: {}, patch: {}, put: {}, delete: {} };
  }

  async get<T>(route: string): Promise<T> {
    // storing `undefined` here makes it non-obvious to verify (you have to use the `in` keyword)
    // we don't want to potentially break people's test by changing it though
    this.calls.get[route] = undefined;
    const response = this._routePayloads.get?.[route];
    return Promise.resolve(response as T);
  }

  async post<T>(route: string, data: Record<string, unknown>): Promise<T> {
    this.calls.post[route] = data || {};
    const response = this._routePayloads.post?.[route];
    return response as T;
  }

  async put<T>(route: string, data: Record<string, unknown>): Promise<T> {
    this.calls.put[route] = data || {};
    const response = this._routePayloads.put?.[route];
    return response as T;
  }

  async patch<T>(route: string, data: Record<string, unknown>): Promise<T> {
    this.calls.patch[route] = data || {};
    const response = this._routePayloads.patch?.[route];
    return response as T;
  }

  async delete<T>(route: string): Promise<T> {
    // storing `undefined` here makes it non-obvious to verify (you have to use the `in` keyword)
    // we don't want to potentially break people's test by changing it though
    this.calls.delete[route] = undefined;
    const response = this._routePayloads.delete?.[route];
    return response as T;
  }

  // eslint-disable-next-line class-methods-use-this
  raw<T = unknown>(_path: string, _options: Omit<RequestOptions, 'json'>): Promise<Response<T>> {
    return Promise.reject(new Error('method not implemented'));
  }

  resetCalls(): void {
    this.calls = { get: {}, post: {}, patch: {}, put: {}, delete: {} };
  }
}

export interface ICachedHttpClient extends IHttpClient {
  getNoCache<T>(route: string): Promise<T>;
}
export class CachedClient implements ICachedHttpClient {
  readonly #httpClient: IHttpClient;

  readonly #logger: Logger;

  readonly #cache: NodeCache;

  constructor(httpClient: HttpClient, logger: Logger, cache: NodeCache) {
    this.#httpClient = httpClient;
    this.#logger = logger;
    this.#cache = cache;
  }

  async #get<T>(route: string, noCache: boolean): Promise<T> {
    if (!noCache) {
      const cached = this.#cache.get<T>(route);
      if (cached) {
        this.#logger?.debug(`returning cached result for route "${route}"`);
        return cached;
      }
    }
    const result = await this.#httpClient.get<T>(route);
    this.#cache.set(route, result);
    return result;
  }

  public async get<T>(route: string): Promise<T> {
    return await this.#get(route, false);
  }

  public async getNoCache<T>(route: string): Promise<T> {
    return await this.#get(route, true);
  }

  public async post<T>(route: string, data?: Record<string, unknown>): Promise<T> {
    return await this.#httpClient.post<T>(route, data);
  }

  public async put<T>(route: string, data?: Record<string, unknown>): Promise<T> {
    return await this.#httpClient.put<T>(route, data);
  }

  public async patch<T>(route: string, data?: Record<string, unknown>): Promise<T> {
    return await this.#httpClient.patch<T>(route, data);
  }

  public async delete(route: string): Promise<void> {
    return await this.#httpClient.delete(route);
  }

  async raw<T = unknown>(path: string, options: Omit<RequestOptions, 'json'>): Promise<Response<T>> {
    return await this.#httpClient.raw(path, options);
  }
}

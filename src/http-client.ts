import got, {
  Response,
  Got,
  Options,
  CancelableRequest,
  HTTPError,
  CancelError,
  Method,
  Headers,
} from 'got/dist/source';
import { AbortSignal } from 'abort-controller';
import NodeCache from 'node-cache';
import { GenericLogger, HttpLogger, Logger, NoOpLogger, PinoLogger } from './loggers';

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

export interface HttpClientConfig {
  basicAuthUserName?: string;
  basicAuthPassword?: string;
  bearerToken?: string;
}

export type HeaderFunction = () => Headers;

export class RequestException extends Error {
  readonly statusCode;

  readonly stack;

  readonly innerError;

  constructor({
    message,
    statusCode,
    innerError,
    stack,
  }: {
    message: string;
    statusCode?: string | number;
    innerError: Error;
    stack?: string;
  }) {
    super(message);
    this.statusCode = statusCode;
    this.stack = stack;
    this.innerError = innerError;
  }
}

type HttpClientInitParams = {
  prefixUrl?: string;
  logger?: Logger;
  config?: HttpClientConfig;
  options?: Options;
  headerFunc?: HeaderFunction;
};

export class HttpClient implements IHttpClient {
  readonly #got: Got;

  readonly #logger: HttpLogger = new NoOpLogger();

  readonly #prefixUrl: string | undefined;

  readonly #headerFunc: HeaderFunction | undefined;

  constructor(initParams?: HttpClientInitParams) {
    const addToHeader = (header: Record<string, string>) => {
      gotOptions.headers ??= header;
      gotOptions.headers = { ...gotOptions.headers, ...header };
    };

    const gotOptions: Options = {
      retry: 0,
      ...initParams?.options,
      context: { ...initParams?.options?.context, ...initParams?.config },
      prefixUrl: initParams?.prefixUrl,
    };

    if (initParams?.config?.basicAuthUserName && initParams?.config?.basicAuthPassword) {
      addToHeader({
        Authorization: `Basic ${Buffer.from(
          `${initParams?.config.basicAuthUserName}:${initParams?.config.basicAuthPassword}`,
        ).toString('base64')}`,
      });
    } else if (initParams?.config?.bearerToken) {
      addToHeader({ Authorization: `Bearer ${initParams?.config.bearerToken}` });
    }

    if (initParams?.logger) {
      this.#logger =
        initParams.logger.constructor?.name === 'Pino'
          ? new PinoLogger(initParams.logger)
          : new GenericLogger(initParams.logger);
    }

    if (initParams?.headerFunc) {
      this.#headerFunc = initParams?.headerFunc;
    }

    this.#prefixUrl = initParams?.prefixUrl;
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
      const responsePromise = this.#request(sanitizedPath, options);
      const [response, json] = await Promise.all([responsePromise, responsePromise.json<T>()]);
      this.#logger.logSuccess(response, options);
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
  #processOptions = (
    method: Method,
    data: Record<string, unknown> | undefined,
    options?: RequestOptions,
  ): RequestOptions => {
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
    return {
      ...(optionsWithComputedHeaders ?? {}),
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

  async post<T>(path: string, data?: Record<string, unknown>, options?: Omit<RequestOptions, 'json'>): Promise<T> {
    const opts = this.#processOptions('POST', data, options);
    return await this.#requestJson({
      path,
      options: opts,
    });
  }

  async put<T>(path: string, data?: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    const opts = this.#processOptions('PUT', data, options);
    return await this.#requestJson({
      path,
      options: opts,
    });
  }

  async patch<T>(path: string, data?: Record<string, unknown>, options?: RequestOptions): Promise<T> {
    const opts = this.#processOptions('PATCH', data, options);
    return await this.#requestJson({
      path,
      options: opts,
    });
  }

  async delete(path: string, options?: RequestOptions): Promise<void> {
    const o = this.#processOptions('DELETE', undefined, options);
    await this.#requestJson({
      path,
      options: o,
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
    return await this.#got(path, options);
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

  public async get<T>(route: string): Promise<T> {
    // storing `undefined` here makes it non-obvious to verify (you have to use the `in` keyword)
    // we don't want to potentially break people's test by changing it though
    this.calls.get[route] = undefined;
    const response = this._routePayloads.get?.[route];
    return Promise.resolve(response as T);
  }

  public async post<T>(route: string, data: Record<string, unknown>): Promise<T> {
    this.calls.post[route] = data || {};
    const response = this._routePayloads.post?.[route];
    return response as T;
  }

  public async put<T>(route: string, data: Record<string, unknown>): Promise<T> {
    this.calls.put[route] = data || {};
    const response = this._routePayloads.put?.[route];
    return response as T;
  }

  public async patch<T>(route: string, data: Record<string, unknown>): Promise<T> {
    this.calls.patch[route] = data || {};
    const response = this._routePayloads.patch?.[route];
    return response as T;
  }

  public async delete<T>(route: string): Promise<T> {
    // storing `undefined` here makes it non-obvious to verify (you have to use the `in` keyword)
    // we don't want to potentially break people's test by changing it though
    this.calls.delete[route] = undefined;
    const response = this._routePayloads.delete?.[route];
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
}

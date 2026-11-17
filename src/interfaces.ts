import { OptionsInit, RequestError, Response } from 'got';

export interface Logger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface HttpLogger {
  logSuccess(response: Response, options: RequestOptions): void;
  logFailure(error: RequestError): void;
}

export const requestOptionKeys = [
  'method',
  'headers',
  'json',
  'form',
  'context',
  'timeout',
  'retry',
  'decompress',
  'followRedirect',
] as const;

type GotOptions = Partial<Pick<OptionsInit, (typeof requestOptionKeys)[number]>>;

export type RequestOptions = GotOptions & {
  abortSignal?: AbortSignal;
  isForm?: boolean;
};

export type HttpMethodCall = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface IHttpClient {
  get<T>(path: string, options?: Omit<RequestOptions, 'json'>): Promise<T>;
  post<T>(path: string, data?: unknown, options?: Omit<RequestOptions, 'json'>): Promise<T>;
  patch<T>(path: string, data?: unknown, options?: Omit<RequestOptions, 'json'>): Promise<T>;
  put<T>(path: string, data?: unknown, options?: Omit<RequestOptions, 'json'>): Promise<T>;
  delete(path: string, options?: Omit<RequestOptions, 'json'>, data?: unknown): Promise<void>;
  raw<T = unknown>(path: string, options: Omit<RequestOptions, 'json'>): Promise<Response<T>>;
  /** Streams the response body as it arrives. The request is sent lazily, so any errors are raised during iteration. */
  stream?(
    method: HttpMethodCall,
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'json'>,
  ): AsyncIterable<Uint8Array>;
}

/** The cache `CachedClient` stores GET responses in, e.g. a `NodeCache` from `node-cache`. Expiry is up to the cache. */
export interface RouteCache {
  get(route: string): unknown;
  set(route: string, value: unknown): unknown;
}

export interface HttpClientConfig {
  basicAuthUserName?: string;
  basicAuthPassword?: string;
  bearerToken?: string;
}

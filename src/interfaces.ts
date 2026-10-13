import { OptionsInit, RequestError, Response } from 'got/dist/source';

export interface Logger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface HttpLogger {
  logSuccess(response: Response, options: RequestOptions): void;
  logFailure(error: RequestError): void;
}

type GotOptions = Pick<
  OptionsInit,
  'context' | 'method' | 'timeout' | 'decompress' | 'json' | 'retry' | 'headers' | 'form' | 'followRedirect'
>;

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
  stream?(
    method: HttpMethodCall,
    path: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'json'>,
  ): Promise<AsyncIterable<Uint8Array>>;
}

export interface HttpClientConfig {
  basicAuthUserName?: string;
  basicAuthPassword?: string;
  bearerToken?: string;
}

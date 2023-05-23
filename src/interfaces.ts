import { CancelError, HTTPError, Options, Response } from 'got/dist/source';

export interface Logger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export interface HttpLogger {
  logSuccess(response: Response, options: RequestOptions): void;
  logFailure(error: HTTPError | CancelError): void;
}

type GotOptions = Partial<
  Pick<
    Options,
    'context' | 'method' | 'timeout' | 'decompress' | 'json' | 'retry' | 'headers' | 'form' | 'followRedirect'
  >
>;

export type RequestOptions = GotOptions & {
  abortSignal?: AbortSignal;
  isForm?: boolean;
};

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

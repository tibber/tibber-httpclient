import * as request from "request-promise";
import * as moment from "moment";

export interface Logger {
    info?(...any);
    error?(...any);
    debug?(...any);
}

export interface Cache {
    get<T>(key: string): T;
    set<T>(key: string, payload: T): void;
}

export interface IHttpClient {
  get<T>(route: string, timeout?: number): Promise<T>;
  post<T>(route: string, payload?: object, timeout?: number): Promise<T>;
  patch<T>(route: string, payload?: object, timeout?: number): Promise<T>;
  put<T>(route: string, payload: object, timeout?: number): Promise<T>;
  delete(route: string, timeout?: number);
}

export interface ICachedHttpClient extends IHttpClient {
  getNoCache<T>(route: string): Promise<T>;
}

class WrapperLogger {
  private logger: Logger;
  constructor(logger?: Logger) {
    this.logger = logger || {};
  }
  public info() {

    this.logger.info && this.logger.info.apply(this.logger, arguments);
  }
  public error() {
    this.logger.error && this.logger.error.apply(this.logger, arguments);
  }
  public debug() {
    this.logger.debug && this.logger.debug.apply(this.logger, arguments);
  }
}

type HTTP_METHOD = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class HttpClient implements IHttpClient {

  private _baseUrl: string;
  private _logger: Logger;
  private _defaultHeaders: any;
  constructor(baseUrl: string, logger?: Logger, basicAuthUser?: string, basicAuthPwd?: string, bearer?: string, defaultHeaders?: object) {

    if (!baseUrl)
        throw new Error("baseUrl must be defined");

    this._baseUrl = baseUrl;
    this._logger = new WrapperLogger(logger);

    if (basicAuthUser && basicAuthPwd) {
      this._defaultHeaders = {
          "Authorization": "Basic " + new Buffer(basicAuthUser + ":" + basicAuthPwd).toString("base64")
        };
    }
    else if (bearer) {
      this._defaultHeaders = {
        "Authorization": "Bearer " + bearer
      };
    }
    this._defaultHeaders = defaultHeaders
      ? Object.assign(this._defaultHeaders || {}, defaultHeaders)
      : this._defaultHeaders;
  }

  private async _request(method: HTTP_METHOD, path: string, body?: object, timeout?: number) {
    const url = `${this._baseUrl}${path}`;
    const start = moment();

    const options = {
      method: method,
      uri: url,
      body: body,
      headers: this._defaultHeaders,
      resolveWithFullResponse: true,
      json: true,
      timeout: timeout
    };
    try {
      const result = await request(options);
      this._logger.info(`${method} ${url} ${result.statusCode} (${moment().diff(start, "milliseconds")} ms)`);
      this._logger.debug("request-options", options);
      return result.body;
    }
    catch (error) {

      let message = "";
      if (error.response && error.response.errors && error.response.errors.length > 0) {
        message = error.response.errors.join(",");
      }
      else {
        message = error.toString && error.toString();
      }
      this._logger.error("\n"
      + "--------------------------------------------------------------------\n"
      + `${method} ${url} ${error.response && error.response.statusCode || "<unknown statuscode>"} (${moment().diff(start, "milliseconds")} ms)\n`
      + `request-options: ${JSON.stringify(options)}\n`
      + `error:${message}\n` + "--------------------------------------------------------------------");
      const { statusCode, error: exception } = error;

      throw new RequestException(message, statusCode, exception && exception.err ? exception.err : exception);
    }
  }

  public async get<T>(route: string, timeout: number): Promise<T> {
    return await this._request("GET", route, undefined, timeout);
  }

  public async post<T>(route: string, payload?: object, timeout?: number): Promise<T> {
    return await this._request("POST", route, payload, timeout);
  }

  public async patch<T>(route: string, payload?: object, timeout?: number): Promise<T> {
    return await this._request("PATCH", route, payload);
  }

  public async put<T>(route: string, payload: object, timeout?: number): Promise<T> {
    return await this._request("PUT", route, payload, timeout);
  }

  public async delete(route: string, timeout?: number) {
    return await this._request("DELETE", route, undefined, timeout);
  }
}

export class RequestException extends Error {
    public statusCode;
    public innerError;
    constructor(message, statusCode, inner) {
        super(message);
        this.statusCode = statusCode;
        this.innerError = inner;
    }
}

export class TestHttpClient implements IHttpClient {
    public _routePayloads: any;
    public calls: any;

    constructor(routePayloads) {
        this._routePayloads = routePayloads;
        this.calls = { get: {}, post: {}, patch: {}, put: {}, delete: {} };
    }

    public async get(route) {
        this.calls.get[route] = {};
        const result = this._routePayloads.get[route];

        return this._routePayloads.get[route];
    }

    public async post(route, payload) {
        this.calls.post[route] = payload || {};
        return this._routePayloads.post[route];
    }

    public async put(route, payload) {
        this.calls.put[route] = payload || {};
        return this._routePayloads.put[route];
    }

    public async patch(route, payload) {
        this.calls.patch[route] = payload || {};
        return this._routePayloads.patch[route];
    }

    public async delete(route) {
        this.calls.delete[route] = undefined;
        return this._routePayloads.delete[route];
    }
}

export class CachedClient implements ICachedHttpClient {
    private _httpClient: IHttpClient;
    private _logger: Logger;
    private _cache: Cache;
    constructor(httpClient: HttpClient, logger: Logger, cache: Cache) {
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

    public async post<T>(route: string, payload?: object): Promise<T> {
        return await this._httpClient.post<T>(route, payload);
    }

    public async put<T>(route: string, payload?: object): Promise<T> {
        return await this._httpClient.put<T>(route, payload);
    }

    public async patch<T>(route: string, payload?: object): Promise<T> {
        return await this._httpClient.patch<T>(route, payload);
    }

    public async delete(route: string): Promise<void> {
        return await this._httpClient.delete(route);
    }
}


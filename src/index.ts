import * as request from "request-promise";
import * as moment from "moment";

export interface Logger {
    info?(...any);
    error?(...any);
    debug?(...any);
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

export class HttpClient {

    private _baseUrl: string;
    private _logger: Logger;
    private _defaultHeaders: any;
    constructor(baseUrl: string, logger?: Logger, basicAuthUser?: string, basicAuthPwd?: string) {

        if (!baseUrl)
            throw new Error("baseUrl must be defined");

        this._baseUrl = baseUrl;
        this._logger = new WrapperLogger(logger);

        if (basicAuthUser && basicAuthPwd) {
            this._defaultHeaders = {
                "Authorization": "Basic " + new Buffer(basicAuthUser + ":" + basicAuthPwd).toString("base64")
            };
        }
    }

    private async _request(method: HTTP_METHOD, path: string, body?: object) {

        const url = `${this._baseUrl}${path}`;
        const start = moment();

        const options = {
            method: method,
            uri: url,
            body: body,
            headers: this._defaultHeaders,
            resolveWithFullResponse: true
        };
        try {
            const result = await request(options);
            this._logger.info(`${method} ${url} ${result.statusCode} (${moment().diff(start, "milliseconds")} ms)`);
            this._logger.debug("request-options", options);

            return result.body ? JSON.parse(result.body) : undefined;
        }
        catch (error) {

            let message = "";
            if (error.response && error.response.errors && error.response.errors.length > 0) {
                message = error.response.errors.join(",");
            }
            else {
                message = error.toString && error.toString();
            }
            this._logger.error("--------------------------------------------------------------------\n"
                + `${method} ${url} ${error.response && error.response.statusCode || "<unknown statuscode>"} (${moment().diff(start, "milliseconds")} ms)\n`
                + `request-options: ${JSON.stringify(options)}\n`
                + `error:${message}\n` + "--------------------------------------------------------------------");
            throw error;
        }
    }

    public async get<T>(route: string): Promise<T> {
        return await this._request("GET", route);
    }

    public async post<T>(route: string, payload?: object): Promise<T> {
        return await this._request("POST", route, payload);
    }

    public async patch<T>(route: string, payload?: object): Promise<T> {
        return (await this._request("PATCH", route, payload));
    }

    public async put<T>(route: string, payload: object): Promise<T> {
        return await this._request("PATCH", route, payload);
    }

    public async delete(route: string) {
        return await this._request("DELETE", route);
    }
}

export class TestHttpClient {
    public _routePayloads: any;
    public calls: any;

    constructor(routePayloads) {
        this._routePayloads = routePayloads;
        this.calls = { get: {}, post: {}, patch: {}, delete: {} };
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

    public async patch(route, payload) {
        this.calls.patch[route] = payload || {};
        return this._routePayloads.patch[route];
    }

    public async delete(route) {
        this.calls.delete[route] = undefined;
        return this._routePayloads.delete[route];
    }
}


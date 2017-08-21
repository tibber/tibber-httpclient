import request from 'request-promise-json';

class DummyLogger {
    info() { }
    error() { }
}

export class HttpClient {

    constructor(baseUrl, logger, basicAuthUser, basicAuthPwd) {

        if (!baseUrl)
            throw new Error('baseUrl must be defined');

        this._baseUrl = baseUrl;
        this._logger = logger || new DummyLogger();

        if (basicAuthUser && basicAuthPwd) {
            this._defaultHeaders = {
                "Authorization": "Basic " + new Buffer(basicAuthUser + ":" + basicAuthPwd).toString("base64")
            }
        }
    }

    async _request(method, path, body) {

        this._logger.info(`remote call ${method} ${this._baseUrl}${path}`, body ? `, body: ${JSON.stringify(body)}` : "");

        try {
            return await request.request({
                method: method,
                url: `${this._baseUrl}${path}`,
                body: body,
                headers: this._defaultHeaders
            });
        }
        catch (error) {
            let message = error.message;
            if (error.response && error.response.errors && error.response.errors.length > 0)
                message = error.response.errors.join("\n");
                
            _this._logger.error(`error while invoking ${_this._baseUrl}${path}: ${message}`);
            throw error;
        }
    }

    async get(route) {
        return await this._request('GET', route);
    }

    async post(route, payload) {
        return await this._request('POST', route, payload);
    }

    async patch(route, payload) {
        return await this._request('PATCH', route, payload);
    }

    async delete(route) {
        return await this._request('DELETE', route);
    }
}

export class TestHttpClient {

    constructor(routePayloads) {
        this._routePayloads = routePayloads;
        this.calls = { get: {}, post: {}, patch: {}, delete: {} };
    }

    async get(route) {

        this.calls.get[route] = {};
        let result = this._routePayloads.get[route];

        return this._routePayloads.get[route];
    }

    async post(route, payload) {
        this.calls.post[route] = payload || {};
        return this._routePayloads.post[route];
    }

    async patch(route, payload) {
        this.calls.patch[route] = payload || {};
        return this._routePayloads.patch[route];
    }

    async delete(route) {
        this.calls.delte[route] = null;
        return this._routePayloads.delete[route];
    }
}


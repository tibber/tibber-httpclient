import request from 'request-promise';
import moment from 'moment';

class WrapperLogger {
    constructor(logger){
        this.logger = logger||{};
    }
    info() { 

      this.logger.info && this.logger.info(...arguments);
    }
    error() { 
        this.logger.error && this.logger.error(...arguments);
    }
    debug() { 
        this.logger.debug && this.logger.debug(...arguments);
    }
}

export class HttpClient {

    constructor(baseUrl, logger, basicAuthUser, basicAuthPwd) {

        if (!baseUrl)
            throw new Error('baseUrl must be defined');

        this._baseUrl = baseUrl;
        this._logger = new WrapperLogger(logger);

        if (basicAuthUser && basicAuthPwd) {
            this._defaultHeaders = {
                "Authorization": "Basic " + new Buffer(basicAuthUser + ":" + basicAuthPwd).toString("base64")
            }
        }
    }

    async _request(method, path, body) {

        const url = `${this._baseUrl}${path}`;
        const start = moment();        
        let sw = {};
        const options = {
            method: method,
            uri: url,
            body: body,
            headers: this._defaultHeaders,
            resolveWithFullResponse: true
        };
        try {
            const result = await request(options);
            this._logger.info(`${method} ${url} ${result.statusCode} (${moment().diff(start,'milliseconds')} ms)`);
            this._logger.debug('request-options', options);
            
            return result.body ? JSON.parse(result.body): undefined;            
        }
        catch (error) {
         
            let message = null;
            if (error.response && error.response.errors && error.response.errors.length > 0) {
                message = error.response.errors.join(",");
            }
            else {
                message = error.toString && error.toString();
            }
            this._logger.error('--------------------------------------------------------------------\n'
                                +`${method} ${url} ${error.response && error.response.statusCode || '<unknown statuscode>'} (${moment().diff(start,'milliseconds')} ms)\n`
                                +`request-options: ${JSON.stringify(options)}\n`
                                +`error:${message}\n`+'--------------------------------------------------------------------');
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


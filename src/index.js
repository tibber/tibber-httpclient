import request from 'request-promise-json';

export class HttpClient {

    constructor(baseUrl, logger, basicAuthUser, basicAuthPwd) {

        if (!baseUrl)
           throw new Error('baseUrl must be defined');

        if (!logger)
           throw new Error('logger must be defined');

        this._baseUrl = baseUrl;
        this._logger = logger;

        if (basicAuthUser && basicAuthPwd) {
            this._defaultHeaders = {
                "Authorization": "Basic " + new Buffer(basicAuthUser + ":" + basicAuthPwd).toString("base64")
            }
        }
    }

    async _request(method, path, body) {

        this._logger.info('Remote call');
        this._logger.info(`${method} ${this._baseUrl}${path}`, body);
        
        try{
        return await request.request({
            method: method,
            url: `${this._baseUrl}${path}`,
            body: body,
            headers: this._defaultHeaders 
        });}
        catch(error){
            this._logger.error(`Error while invoking ${this._baseUrl}${path}`, error.message)
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
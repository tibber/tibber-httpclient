var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as request from "request-promise";
import * as moment from "moment";
class WrapperLogger {
    constructor(logger) {
        this.logger = logger || {};
    }
    info() {
        this.logger.info && this.logger.info(arguments).apply(this.logger, arguments);
    }
    error() {
        this.logger.error && this.logger.error(arguments).apply(this.logger, arguments);
    }
    debug() {
        this.logger.debug && this.logger.debug.apply(this.logger, arguments);
    }
}
export class HttpClient {
    constructor(baseUrl, logger, basicAuthUser, basicAuthPwd) {
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
    _request(method, path, body) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const result = yield request(options);
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
        });
    }
    get(route) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._request("GET", route);
        });
    }
    post(route, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._request("POST", route, payload);
        });
    }
    patch(route, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this._request("PATCH", route, payload));
        });
    }
    put(route, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._request("PATCH", route, payload);
        });
    }
    delete(route) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._request("DELETE", route);
        });
    }
}
export class TestHttpClient {
    constructor(routePayloads) {
        this._routePayloads = routePayloads;
        this.calls = { get: {}, post: {}, patch: {}, delete: {} };
    }
    get(route) {
        return __awaiter(this, void 0, void 0, function* () {
            this.calls.get[route] = {};
            const result = this._routePayloads.get[route];
            return this._routePayloads.get[route];
        });
    }
    post(route, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            this.calls.post[route] = payload || {};
            return this._routePayloads.post[route];
        });
    }
    patch(route, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            this.calls.patch[route] = payload || {};
            return this._routePayloads.patch[route];
        });
    }
    delete(route) {
        return __awaiter(this, void 0, void 0, function* () {
            this.calls.delete[route] = undefined;
            return this._routePayloads.delete[route];
        });
    }
}

import { CancelError, HTTPError } from 'got';
import { createServer, Server } from 'http';
import { HttpClient, TestHttpClient, RequestException } from './http-client';

const Port = 38080;
const ServerUrl = `http://localhost:${Port}`;

interface Todo {
  id?: number;
  userId: number;
  title: string;
  body: string;
}

describe('http client', () => {
  let server: Server;

  beforeAll(() => {
    server = createServer(async (req, res) => {
      switch (req.url) {
        case '/400':
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/plain');
          res.end('400 Bad Request');
          break;
        default:
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end('200 OK');
          break;
      }
    }).listen(Port);
  });

  afterAll(() => {
    server.close();
  });

  test('Instantiate client without init parameters', async () => {
    const client = new HttpClient();
    const response: Todo = await client.get('https://jsonplaceholder.typicode.com/posts/1');
    expect(response.userId).toBe(1);
  });

  test('basic GET request', async () => {
    const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
    const response: Todo = await client.get('posts/1');
    expect(response.id).toBe(1);
  });

  test('GET request, return response', async () => {
    const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
    const response = await client.raw('posts/1', { method: 'GET' });
    expect(response.statusCode).toBe(200);
  });

  test('POST', async () => {
    const data = {
      userId: 1,
      title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
      body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto',
    };
    const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
    const response: Todo = await client.post('posts', data);
    expect(response.id).toBe(101);
  });

  test('POST form url encoded', async () => {
    const data = {
      userId: 1,
      title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
      body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto',
    };
    const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
    const response: Todo = await client.post('posts', data, { isForm: true });
    expect(response.id).toBe(101);
  });

  test('PATCH', async () => {
    const data: Partial<Todo> = {
      title: 'title post',
    };
    const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
    const response: Todo = await client.patch('posts/1', data);
    expect(response.userId).toBe(1);
  });

  test('DELETE', async () => {
    const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
    await client.delete('posts/1');
  });

  test('Canceling request with AbortSignal', async () => {
    const controller = new AbortController();
    const client = new HttpClient({ prefixUrl: ServerUrl });

    setTimeout(() => {
      controller.abort();
    }, 5);

    const error = await getError<RequestException>(
      async () => await client.get('200', { abortSignal: controller.signal }),
    );
    expect(error).toBeInstanceOf(RequestException);
    expect(error.innerError).toBeInstanceOf(CancelError);
  });

  test('Error request', async () => {
    const client = new HttpClient({
      prefixUrl: 'http://localhost:38080',
    });

    const error = await getError<RequestException>(async () => await client.get('400'));
    expect(error).toBeInstanceOf(RequestException);
    expect(error.statusCode).toBe(400);
  });

  test('Create basic auth header', async () => {
    const client = new HttpClient({
      prefixUrl: ServerUrl,
      config: { basicAuthPassword: '1234', basicAuthUserName: 'myname' },
      options: { headers: { test: '123' } },
    });

    const error = await getError<RequestException>(
      async () => await client.get('400', { headers: { nonHeader: 'abc' } }),
    );

    expect(error).toBeInstanceOf(RequestException);
    expect(error.innerError).toBeInstanceOf(HTTPError);
    if (error.innerError instanceof HTTPError) {
      expect(error.innerError.options.headers.authorization).toBe('Basic bXluYW1lOjEyMzQ=');
      expect(error.innerError.options.headers.nonheader).toBe('abc');
      expect(error.innerError.options.headers.test).toBe('123');
    }
  });

  test('Create header from headerFunc', async () => {
    const client = new HttpClient({
      prefixUrl: ServerUrl,
      config: { basicAuthPassword: '1234', basicAuthUserName: 'myname' },
      headerFunc: () => ({ test: '123' }),
    });

    const error = await getError<RequestException>(
      async () => await client.get('400', { headers: { nonHeader: 'abc' } }),
    );
    expect(error).toBeInstanceOf(RequestException);
    expect(error.innerError).toBeInstanceOf(HTTPError);
    if (error.innerError instanceof HTTPError) {
      expect(error.innerError.options.headers.authorization).toBe('Basic bXluYW1lOjEyMzQ=');
      expect(error.innerError.options.headers.nonheader).toBe('abc');
      expect(error.innerError.options.headers.test).toBe('123');
    }
  });

  test('Can clear TestHttpClient calls', async () => {
    const url = '/index';
    const payload = { payload: 'payload' };
    const response = { success: true };
    const client = new TestHttpClient({
      get: {
        [url]: response,
      },
      post: {
        [url]: response,
      },
      put: {
        [url]: response,
      },
      patch: {
        [url]: response,
      },
      delete: {
        [url]: response,
      },
    });
    let res;
    res = await client.get(url);
    expect(res).toStrictEqual(response);
    expect(client.calls.get[url]).toStrictEqual(undefined);

    res = await client.post(url, payload);
    expect(res).toStrictEqual(response);
    expect(client.calls.post[url]).toStrictEqual(payload);

    res = await client.put(url, payload);
    expect(res).toStrictEqual(response);
    expect(client.calls.put[url]).toStrictEqual(payload);

    res = await client.patch(url, payload);
    expect(res).toStrictEqual(response);
    expect(client.calls.patch[url]).toStrictEqual(payload);

    res = await client.delete(url);
    expect(res).toStrictEqual(response);
    expect(client.calls.delete[url]).toStrictEqual(undefined);

    client.resetCalls();
    expect(url in client.calls.get).toBe(false);
    expect(url in client.calls.post).toBe(false);
    expect(url in client.calls.put).toBe(false);
    expect(url in client.calls.patch).toBe(false);
    expect(url in client.calls.delete).toBe(false);
  });
});

class NoErrorThrownError extends Error {}

const getError = async <TError extends Error>(call: () => unknown): Promise<TError> => {
  try {
    await call();
    throw new NoErrorThrownError();
  } catch (error: unknown) {
    return error as TError;
  }
};

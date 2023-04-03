import { AbortController } from 'abort-controller';
import { CancelError, HTTPError } from 'got';
import { HttpClient, RequestException, TestHttpClient } from './http-client';

interface Todo {
  id?: number;
  userId: number;
  title: string;
  body: string;
}

describe('http client', () => {
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
    const { signal } = controller;
    const client = new HttpClient({ prefixUrl: 'https://httpbin.org' });
    setTimeout(() => {
      controller.abort();
    }, 10);

    const testFn = async () =>
      await client.get('anything', {
        abortSignal: signal,
      });
    const error = await getError<RequestException>(testFn);
    expect(error).toBeInstanceOf(RequestException);
    expect(error.innerError).toBeInstanceOf(CancelError);
  });

  test('Error request', async () => {
    const client = new HttpClient({
      prefixUrl: 'https://httpbin.org',
    });

    const testFn = async () => await client.get('status/400');

    const error = await getError<RequestException>(testFn);
    expect(error).toBeInstanceOf(RequestException);
    expect(error.innerError).toBeInstanceOf(HTTPError);
    expect(error.statusCode).toBe(400);
  });

  test('Create basic auth header', async () => {
    const client = new HttpClient({
      prefixUrl: 'https://httpbin.org',
      config: { basicAuthPassword: '1234', basicAuthUserName: 'myname' },
      options: { headers: { test: '123' } },
    });

    const testFn = async () => await client.get('status/400', { headers: { nonHeader: 'abc' } });
    const error = await getError<RequestException>(testFn);
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
      prefixUrl: 'https://httpbin.org',
      config: { basicAuthPassword: '1234', basicAuthUserName: 'myname' },
      headerFunc: () => ({ test: '123' }),
    });

    const testFn = async () => await client.get('status/400', { headers: { nonHeader: 'abc' } });
    const error = await getError<RequestException>(testFn);
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

const getError = async <TError extends Error>(call: () => unknown): Promise<TError> => {
  try {
    return (await call()) as TError;
  } catch (error: unknown) {
    return error as TError;
  }
};

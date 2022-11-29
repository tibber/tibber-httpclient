import test from 'ava';
import { AbortController } from 'abort-controller';
import { HTTPError } from 'got/dist/source';
import { HttpClient, RequestException, TestHttpClient } from '../src';

interface Todo {
  id?: number;
  userId: number;
  title: string;
  body: string;
}

test('Instantiate client without init parameters', async (t) => {
  const client = new HttpClient();
  const response: Todo = await client.get('https://jsonplaceholder.typicode.com/posts/1');
  t.is(response.userId, 1);
});

test('basic GET request', async (t) => {
  const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
  const response: Todo = await client.get('posts/1');
  t.is(response.id, 1);
});

test('GET request, return response', async (t) => {
  const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
  const response = await client.raw('posts/1', { method: 'GET' });
  t.is(response.statusCode, 200);
});

test('POST', async (t) => {
  const data = {
    userId: 1,
    title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
    body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto'
  };
  const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
  const response: Todo = await client.post('posts', data);
  t.is(response.id, 101);
});

test('POST form url encoded', async (t) => {
  const data = {
    userId: 1,
    title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
    body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto'
  };
  const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
  const response: Todo = await client.post('posts', data, { isForm: true });
  t.is(response.id, 101);
});

test('PATCH', async (t) => {
  const data: Partial<Todo> = {
    title: 'title post'
  };
  const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
  const response: Todo = await client.patch('posts/1', data);
  t.is(response.userId, 1);
});

test('DELETE', async (t) => {
  const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
  await client.delete('posts/1');
  // returns void
  t.is(1, 1);
});

test('Canceling request with AbortSignal', async (t) => {
  const controller = new AbortController();
  const { signal } = controller;
  const client = new HttpClient({ prefixUrl: 'https://httpbin.org' });
  setTimeout(() => {
    controller.abort();
  }, 10);
  t.plan(1);
  try {
    await client.get('anything', {
      abortSignal: signal
    });
  } catch (error) {
    if (error instanceof RequestException) {
      t.is(error.innerError.name, 'CancelError');
    }
  }
});

test('Error request', async (t) => {
  const client = new HttpClient({
    prefixUrl: 'https://httpbin.org',
    logger: console
  });
  t.plan(2);
  try {
    await client.get('status/400');
  } catch (error) {
    if (error instanceof RequestException) {
      t.is(error.innerError.name, 'HTTPError');
      t.is(error.statusCode, 400);
    }
  }
});

test('Create basic auth header', async (t) => {
  const client = new HttpClient({
    prefixUrl: 'https://httpbin.org',
    config: { basicAuthPassword: '1234', basicAuthUserName: 'myname' },
    options: { headers: { test: '123' } }
  });
  t.plan(3);
  try {
    // trigger error, to get access to underlying request and check header
    await client.get('status/400', { headers: { nonHeader: 'abc' } });
  } catch (error) {
    if (error instanceof RequestException && error.innerError instanceof HTTPError) {
      t.is(error.innerError.options.headers.authorization, 'Basic bXluYW1lOjEyMzQ=');
      t.is(error.innerError.options.headers.nonheader, 'abc');
      t.is(error.innerError.options.headers.test, '123');
    }
  }
});

test('Create header from headerFunc', async (t) => {
  const client = new HttpClient({
    prefixUrl: 'https://httpbin.org',
    config: { basicAuthPassword: '1234', basicAuthUserName: 'myname' },
    headerFunc: () => ({ test: '123' }),
  });
  t.plan(3);
  try {
    // trigger error, to get access to underlying request and check header
    await client.get('status/400', { headers: { nonHeader: 'abc' } });
  } catch (error) {
    if (error instanceof RequestException && error.innerError instanceof HTTPError) {
      t.is(error.innerError.options.headers.authorization, 'Basic bXluYW1lOjEyMzQ=');
      t.is(error.innerError.options.headers.nonheader, 'abc');
      t.is(error.innerError.options.headers.test, '123');
    }
  }
});

test('Can clear TestHttpClient calls', async (t) => {
  const url = '/index';
  const payload = { payload: 'payload' };
  const response = { success: true };
  const client = new TestHttpClient({
    get: {
      [url]: response
    },
    post: {
      [url]: response
    },
    put: {
      [url]: response
    },
    patch: {
      [url]: response
    },
    delete: {
      [url]: response
    }
  });
  let res;
  res = await client.get(url);
  t.deepEqual(res, response);
  t.deepEqual(client.calls.get[url], undefined);

  res = await client.post(url, payload);
  t.deepEqual(res, response);
  t.deepEqual(client.calls.post[url], payload);

  res = await client.put(url, payload);
  t.deepEqual(res, response);
  t.deepEqual(client.calls.put[url], payload);

  res = await client.patch(url, payload);
  t.deepEqual(res, response);
  t.deepEqual(client.calls.patch[url], payload);

  res = await client.delete(url);
  t.deepEqual(res, response);
  t.deepEqual(client.calls.delete[url], undefined);

  client.resetCalls();
  t.is(url in client.calls.get, false);
  t.is(url in client.calls.post, false);
  t.is(url in client.calls.put, false);
  t.is(url in client.calls.patch, false);
  t.is(url in client.calls.delete, false);
});

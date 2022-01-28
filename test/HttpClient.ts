import test from 'ava';
import { HttpClient, RequestException } from '../src';
import { AbortController } from 'abort-controller';
import { HTTPError } from 'got/dist/source';

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
  const signal = controller.signal;
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
      t.is(error.inner.name, 'CancelError');
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
      t.is(error.inner.name, 'HTTPError');
      t.is(error.code, 400);
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
    if (error instanceof RequestException && error.inner instanceof HTTPError) {
      t.is(error.inner.options.headers.authorization, 'Basic bXluYW1lOjEyMzQ=');
      t.is(error.inner.options.headers.nonheader, 'abc');
      t.is(error.inner.options.headers.test, '123');
    }
  }
});

import test from "ava";
import { HttpClient, RequestException } from '../src/index';
import { AbortController } from 'abort-controller';

interface Todo {
  id?: number;
  userId: any;
  title: string;
  body: string;
}

test('basic GET request', async (t) => {
  const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
  const response: Todo = await client.get('posts/1');
  t.is(response.id, 1);
});

test('POST', async (t) => {
  const payload = {
    userId: 1,
    title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
    body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto'
  };
  const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
  const response: Todo = await client.post('posts', payload);
  t.is(response.id, 101);
});

test('PATCH', async (t) => {
  const payload: Partial<Todo> = {
    title: 'title post'
  };
  const client = new HttpClient({ prefixUrl: 'https://jsonplaceholder.typicode.com' });
  const response: Todo = await client.patch('posts/1', payload);
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
  t.plan(2);
  try {
    await client.get('anything', {
      abortSignal: signal
    });
  } catch (error) {
    t.true(error instanceof RequestException);
    t.is(error.inner.name, 'CancelError');
  }
});

test('Error request', async (t) => {
  const client = new HttpClient({
    prefixUrl: 'https://httpbin.org',
    context: { basicAuthPassword: '1234', basicAuthUserName: 'myname' }
  });
  t.plan(3);
  try {
    await client.get('status/400');
  } catch (error) {
    t.true(error instanceof RequestException);
    t.is(error.inner.name, 'HTTPError');
    t.is(error.code, 400);
  }
});
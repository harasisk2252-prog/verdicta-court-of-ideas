import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/api.mjs';

const call = (route, payload) => handler(new Request(`https://verdicta.test/api/${route}`, payload === undefined ? {} : { method: 'POST', body: JSON.stringify(payload) }));

test('Netlify adapter advertises unavailable shared storage', async () => {
  const response = await call('status');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sharedStorage, false);
});
test('Netlify debate preserves human input, witness and verdict', async () => {
  const response = await call('debate', { topic: 'Should cities limit cars?', mode: 'human-ai', argument: 'Reliable transit should come first.' });
  const debate = await response.json();
  assert.equal(response.status, 200);
  assert.equal(debate.events[1].text, 'Reliable transit should come first.');
  assert.ok(debate.events.some(event => event.role === 'witness'));
  assert.ok(debate.events.at(-1).verdict);
});
test('Netlify refuses persistence instead of simulating success', async () => {
  for (const route of ['rooms', 'gallery']) {
    const response = await call(route, { topic: 'Should cities limit cars?' });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /database/);
  }
  const gallery = await call('gallery');
  assert.equal((await gallery.json()).items.length, 6);
});
test('Netlify rejects malformed and oversized requests', async () => {
  for (const [body, status] of [['{', 400], ['x'.repeat(12001), 413]]) {
    const response = await handler(new Request('https://verdicta.test/api/debate', { method: 'POST', body }));
    assert.equal(response.status, status);
  }
});

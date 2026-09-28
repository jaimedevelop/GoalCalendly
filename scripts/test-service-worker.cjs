const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const handlers = {};
const context = {
  self: { addEventListener: (name, handler) => { handlers[name] = handler; } },
  location: { origin: 'https://example.test' },
  console: { log() {} }, URL, Response,
  caches: {
    open: async () => ({ put: async () => {} }),
    match: async () => new Response('cached'),
  },
  fetch: async () => new Response('latest'),
};
vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), context);

async function run() {
  let response;
  const navigate = () => handlers.fetch({
    request: { method: 'GET', url: 'https://example.test/goals', mode: 'navigate' },
    respondWith: promise => { response = promise; },
  });
  navigate();
  assert.equal(await (await response).text(), 'latest');
  context.fetch = async () => { throw new Error('offline'); };
  navigate();
  assert.equal(await (await response).text(), 'cached');
  let intercepted = false;
  handlers.fetch({
    request: { method: 'GET', url: 'https://example.test/src/store.ts' },
    respondWith: () => { intercepted = true; },
  });
  assert.equal(intercepted, false);
  for (const url of [
    'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
    'https://securetoken.googleapis.com/v1/token',
    'https://us-central1-goal-calendly-staging.cloudfunctions.net/createCheckoutSession',
    'https://checkout.stripe.com/c/pay/test',
    'https://example.test/api/billing',
    'https://example.test/__/auth/handler',
    'https://example.test/subscription',
    'https://example.test/billing/return?status=success',
  ]) {
    handlers.fetch({ request: { method: 'GET', url, mode: 'cors', destination: '' },
      respondWith: () => { throw new Error(`Must not intercept ${url}`); } });
  }
  let writes = 0;
  context.fetch = async () => new Response('current billing shell');
  context.caches.open = async () => ({ put: async () => { writes++; } });
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/billing/return?status=success', mode: 'navigate' },
    respondWith: promise => { response = promise; } });
  assert.equal(await (await response).text(), 'current billing shell');
  assert.equal(writes, 0, 'billing return pages must not be cached');
  context.fetch = async () => new Response('unavailable', { status: 503 });
  navigate();
  assert.equal(await (await response).text(), 'cached', 'server failure falls back to the app shell');
  context.fetch = async () => { throw new Error('offline'); };
  context.caches.match = async () => undefined;
  navigate();
  assert.equal((await response).status, 503, 'a genuinely uncached offline page reports unavailable');
  const deleted = [];
  context.caches.keys = async () => ['goal-calendly-static-v2', 'goal-calendly-dynamic-v2', 'goal-calendly-static-v3', 'unrelated'];
  context.caches.delete = async name => { deleted.push(name); };
  context.self.clients = { claim: async () => {} };
  handlers.activate({ waitUntil: promise => { response = promise; } });
  await response;
  assert.deepEqual(deleted.sort(), ['goal-calendly-dynamic-v2', 'goal-calendly-static-v2']);
  console.log('PASS: navigation/offline fallback, API isolation, billing no-cache, stale cache cleanup');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

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
  console.log('PASS: fresh navigation, offline fallback, development cache bypass');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

// Read-only smoke check; this does not prove authenticated payment behavior.
const [originArg, project] = process.argv.slice(2);
if (!originArg || !project || !/^[a-z0-9-]+$/.test(project)) {
  throw new Error('Usage: node scripts/verify-deployment.mjs https://SITE FIREBASE_PROJECT_ID');
}
const origin = new URL(originArg);
if (origin.protocol !== 'https:') throw new Error('Use an HTTPS deployment URL.');
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}
let index;
for (const path of ['/', '/login', '/subscription', '/billing/return']) {
  const response = await get(new URL(path, origin));
  const html = await response.text();
  if (!response.headers.get('content-type')?.includes('text/html') || !html.includes('id="root"')) {
    throw new Error(`${path}: expected the application HTML`);
  }
  index ??= html;
  console.log(`PASS route ${path}`);
}
const scripts = [...index.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
if (!scripts.length) throw new Error('No application script found.');
let bundle = '';
for (const src of scripts) {
  const url = new URL(src, origin);
  if (url.origin !== origin.origin) continue;
  bundle += await (await get(url)).text();
}
if (!bundle.includes(project)) throw new Error(`Bundle does not identify expected Firebase project ${project}`);
if (/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/.test(bundle)) throw new Error('Potential private Stripe credential in public bundle; value withheld.');
console.log(`PASS public bundle project ${project}; no Stripe secret pattern found`);
console.log('Authenticated Checkout, webhook delivery, Portal, ads and limits require separate release evidence.');

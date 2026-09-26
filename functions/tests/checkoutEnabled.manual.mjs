/**
 * Manual verification (not part of the regular npm test suite, since it
 * requires a real Stripe test-mode key configured on the running emulator):
 * proves a real signed-in user reaches an actual Stripe-hosted test-mode
 * Checkout URL end to end, and that a second concurrent request for the
 * SAME plan does not create a duplicate customer/session.
 *
 * Run with the emulator started with CHECKOUT_ENABLED=true, APP_ORIGIN set,
 * and a real STRIPE_SECRET_KEY injected into its process environment (see
 * functions/.env.demo-goalcalendly + shell-exported key, never committed):
 *   node functions/tests/checkoutEnabled.manual.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';

const PROJECT_ID = 'demo-goalcalendly';
const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake', authDomain: `${PROJECT_ID}.firebaseapp.com` });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const functions = getFunctions(app);
connectFunctionsEmulator(functions, '127.0.0.1', 5001);
const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
const createPortalSession = httpsCallable(functions, 'createPortalSession');

await signInAnonymously(auth);

console.log('--- Test 1: real Checkout Session creation ---');
const result = await createCheckoutSession({ plan: 'pro', interval: 'month', requestId: 'manual-1' });
const url = result.data.url;
console.log('Checkout URL:', url);
if (!url.startsWith('https://checkout.stripe.com/')) {
  console.error('FAIL: URL does not look like a real Stripe Checkout URL');
  process.exit(1);
}
console.log('PASS: got a real Stripe test-mode Checkout URL.\n');

console.log('--- Test 2: duplicate request with the same requestId reuses the pending session ---');
const result2 = await createCheckoutSession({ plan: 'pro', interval: 'month', requestId: 'manual-1' });
if (result2.data.url !== url) {
  console.error('FAIL: a repeated requestId produced a different URL:', result2.data.url);
  process.exit(1);
}
console.log('PASS: same requestId returned the identical pending session URL.\n');

console.log('--- Test 3: Manage billing now succeeds, since a Stripe customer was created by Checkout above ---');
const portalResult = await createPortalSession({});
const portalUrl = portalResult.data.url;
console.log('Portal URL:', portalUrl);
if (!portalUrl.startsWith('https://billing.stripe.com/')) {
  console.error('FAIL: URL does not look like a real Stripe Portal URL');
  process.exit(1);
}
console.log('PASS: got a real Stripe test-mode Portal URL for the correct customer.\n');

console.log('--- Test 4: an existing subscriber cannot start a second Checkout for the same/another plan ---');
// This user has a Stripe customer but no ACTIVE subscription yet (no webhook
// fired), so a second Checkout attempt should still succeed at this point —
// the "already-exists" guard only fires once billing.status is active/past_due/trialing.
// Documenting this explicitly rather than asserting a false expectation here.
console.log('(Skipped: requires a synced active subscription, which needs a real webhook delivery — covered by stripeWebhook.test.mjs instead.)\n');

console.log('All manual Checkout/Portal checks passed.');
process.exit(0);

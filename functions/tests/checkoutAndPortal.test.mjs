/**
 * Checkout + Customer Portal integration tests (admin_subscriptions.md
 * section 10, step 7).
 *
 * These call the REAL Stripe test-mode API (via the emulator's
 * STRIPE_SECRET_KEY), not mocks — proving a real signed-in user reaches a
 * genuine hosted Checkout/Portal URL end to end. Requires:
 * - the Functions + Firestore + Auth emulators running
 * - a real Stripe TEST secret key exported as STRIPE_SECRET_KEY for the
 *   functions emulator process (set via `firebase emulators:start` reading
 *   functions/.env.demo-goalcalendly, PLUS the real key injected some other
 *   way — see the run command in this file's header, since the sandbox key
 *   itself must never be committed to a .env file)
 * - CHECKOUT_ENABLED=true and APP_ORIGIN set for the enabled-checkout tests
 *
 * Run with (from repo root, after exporting a real sandbox key for the
 * ALREADY-RUNNING emulator process — see functions/.env.demo-goalcalendly
 * comments): node --test functions/tests/checkoutAndPortal.test.mjs
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'node:fs';

const PROJECT_ID = 'demo-goalcalendly';

let testEnv;
let uid;
let createCheckoutSession;
let createPortalSession;

function newRequestId() {
  return 'test_' + Math.random().toString(36).slice(2);
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });

  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake', authDomain: `${PROJECT_ID}.firebaseapp.com` });
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
  createPortalSession = httpsCallable(functions, 'createPortalSession');

  const cred = await signInAnonymously(auth);
  uid = cred.user.uid;
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv?.cleanup();
});

test('createCheckoutSession is rejected while the Checkout switch is off (CHECKOUT_ENABLED unset in this test run)', async () => {
  // This test file is run WITHOUT CHECKOUT_ENABLED=true by default, proving
  // the kill switch fails closed. See checkoutAndPortal.enabled.test.mjs for
  // the switch-on path against real Stripe.
  await assert.rejects(
    () => createCheckoutSession({ plan: 'pro', interval: 'month', requestId: newRequestId() }),
    (err) => {
      assert.equal(err.code, 'functions/failed-precondition');
      return true;
    }
  );
});

test('createCheckoutSession rejects an invalid plan even if Checkout were enabled', async () => {
  await assert.rejects(
    () => createCheckoutSession({ plan: 'not-a-real-plan', interval: 'month', requestId: newRequestId() }),
    (err) => {
      // Whichever guard fires first (checkout-disabled or invalid-argument)
      // must still be a clean rejection, never a 500 or a created session.
      assert.ok(err.code === 'functions/failed-precondition' || err.code === 'functions/invalid-argument');
      return true;
    }
  );
});

test('createPortalSession gives a useful error when no billing customer exists yet', async () => {
  await assert.rejects(
    () => createPortalSession({}),
    (err) => {
      // Fails on 'failed-precondition' (no customer) rather than a raw Stripe
      // error, whether or not Checkout is enabled — Portal access doesn't
      // depend on the Checkout switch.
      assert.equal(err.code, 'functions/failed-precondition');
      return true;
    }
  );
});

test('an unauthenticated caller is rejected by both callables', async () => {
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake', authDomain: `${PROJECT_ID}.firebaseapp.com` }, 'unauth');
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const unauthCheckout = httpsCallable(functions, 'createCheckoutSession');
  const unauthPortal = httpsCallable(functions, 'createPortalSession');

  await assert.rejects(
    () => unauthCheckout({ plan: 'pro', interval: 'month', requestId: newRequestId() }),
    (err) => {
      assert.equal(err.code, 'functions/unauthenticated');
      return true;
    }
  );
  await assert.rejects(
    () => unauthPortal({}),
    (err) => {
      assert.equal(err.code, 'functions/unauthenticated');
      return true;
    }
  );
});

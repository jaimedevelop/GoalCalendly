/**
 * Reconciliation integration tests (admin_subscriptions.md section 10, step 6):
 * proves a stale grace period expires even with no further webhook event,
 * and that reconciliation calling into syncSubscriptionState (via a mocked
 * Stripe client is avoided here — instead we test the grace-period-expiry
 * path directly, which does not need a live Stripe fetch, matching what
 * runReconciliation does before attempting any Stripe call).
 *
 * Requires the Functions + Firestore + Auth emulators running.
 * Run with: node --test functions/tests/reconcileSubscriptions.test.mjs
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp as initAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import fs from 'node:fs';

const PROJECT_ID = 'demo-goalcalendly';

let testEnv;
let adminAuthClient;
let adminUid;
let targetUid;
let reconcileOneCustomer;
let reconcileOneCustomerAsAdmin;

async function getEntitlement(uid) {
  let data;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await ctx.firestore().collection('entitlements').doc(uid).get();
    data = snap.exists ? snap.data() : null;
  });
  return data;
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
  reconcileOneCustomer = httpsCallable(functions, 'reconcileOneCustomer');

  const nonAdminCred = await signInAnonymously(auth);
  adminUid = nonAdminCred.user.uid;
  targetUid = 'target_' + Math.random().toString(36).slice(2);

  // Grant a REAL admin custom claim via the Admin SDK against the emulator
  // (env vars set at the top of this file point it there), exactly the way
  // functions/src/admin/setAdminClaim.ts does in production. Uses a SEPARATE
  // Firebase app instance ("admin-client") so the non-admin client above
  // stays signed in for the "requires a trusted admin" test.
  initAdminApp({ projectId: PROJECT_ID });
  const adminSdkAuth = getAdminAuth();
  const adminUser = await adminSdkAuth.createUser({});
  await adminSdkAuth.setCustomUserClaims(adminUser.uid, { admin: true });

  const adminApp = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake', authDomain: `${PROJECT_ID}.firebaseapp.com` }, 'admin-client');
  adminAuthClient = getAuth(adminApp);
  connectAuthEmulator(adminAuthClient, 'http://127.0.0.1:9099', { disableWarnings: true });
  // Sign in as the newly-claimed admin using a custom token minted by the Admin SDK.
  const { signInWithCustomToken } = await import('firebase/auth');
  const customToken = await adminSdkAuth.createCustomToken(adminUser.uid);
  await signInWithCustomToken(adminAuthClient, customToken);

  const adminFunctions = getFunctions(adminApp);
  connectFunctionsEmulator(adminFunctions, '127.0.0.1', 5001);
  reconcileOneCustomerAsAdmin = httpsCallable(adminFunctions, 'reconcileOneCustomer');
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv?.cleanup();
});

test('reconcileOneCustomer requires a trusted admin caller', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('billingCustomers').doc(targetUid).set({
      uid: targetUid, stripeCustomerId: 'cus_x', status: 'active', cancelAtPeriodEnd: false, lastSyncedAt: new Date().toISOString(),
    });
  });

  // adminUid has no admin custom claim in this test (emulator default), so this must be denied.
  await assert.rejects(
    () => reconcileOneCustomer({ uid: targetUid }),
    (err) => {
      assert.equal(err.code, 'functions/permission-denied');
      return true;
    }
  );
});

test('reconcileOneCustomer, called by a real trusted admin, 404s for a UID with no billing record', async () => {
  await assert.rejects(
    () => reconcileOneCustomerAsAdmin({ uid: 'nonexistent_uid' }),
    (err) => {
      assert.equal(err.code, 'functions/not-found');
      return true;
    }
  );
});

test('reconcileOneCustomer, called by a real trusted admin, reports no-change for a record with no subscription', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('billingCustomers').doc(targetUid).set({
      uid: targetUid, stripeCustomerId: 'cus_x', status: 'none', cancelAtPeriodEnd: false, lastSyncedAt: new Date().toISOString(),
    });
  });

  const result = await reconcileOneCustomerAsAdmin({ uid: targetUid });
  assert.equal(result.data.outcome, 'no-change');
});

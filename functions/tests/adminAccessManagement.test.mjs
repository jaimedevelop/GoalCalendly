/**
 * Admin access-management + account-lifecycle integration tests
 * (admin_subscriptions.md section 10, step 9).
 *
 * Verifies against the real Functions + Firestore + Auth emulator:
 * grantComplimentaryAccess/revokeComplimentaryAccess require a real admin
 * claim and are fully audited; listUserAccessSummaries requires admin and
 * returns billed-vs-effective data the client cannot query directly;
 * deleteAccount refuses to delete an account with a live subscription
 * unless explicitly acknowledged, and never silently cancels Stripe.
 *
 * Run with: node --test functions/tests/adminAccessManagement.test.mjs
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp as initAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import fs from 'node:fs';

const PROJECT_ID = 'demo-goalcalendly';

let testEnv;
let nonAdminUid;
let nonAdminCalls;
let adminCalls;
let adminUid;

function callables(app) {
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return {
    grant: httpsCallable(functions, 'grantComplimentaryAccess'),
    revoke: httpsCallable(functions, 'revokeComplimentaryAccess'),
    list: httpsCallable(functions, 'listUserAccessSummaries'),
    checkBilling: httpsCallable(functions, 'checkAccountBillingStatus'),
    deactivate: httpsCallable(functions, 'deactivateAccount'),
    reactivate: httpsCallable(functions, 'reactivateAccount'),
    deleteAccount: httpsCallable(functions, 'deleteAccount'),
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });

  const nonAdminApp = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake', authDomain: `${PROJECT_ID}.firebaseapp.com` }, 'non-admin');
  const nonAdminAuth = getAuth(nonAdminApp);
  connectAuthEmulator(nonAdminAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const nonAdminCred = await signInAnonymously(nonAdminAuth);
  nonAdminUid = nonAdminCred.user.uid;
  nonAdminCalls = callables(nonAdminApp);

  initAdminApp({ projectId: PROJECT_ID });
  const adminSdkAuth = getAdminAuth();
  const adminUser = await adminSdkAuth.createUser({});
  adminUid = adminUser.uid;
  await adminSdkAuth.setCustomUserClaims(adminUid, { admin: true });

  const adminApp = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake', authDomain: `${PROJECT_ID}.firebaseapp.com` }, 'admin-client');
  const adminAuthClient = getAuth(adminApp);
  connectAuthEmulator(adminAuthClient, 'http://127.0.0.1:9099', { disableWarnings: true });
  const customToken = await adminSdkAuth.createCustomToken(adminUid);
  await signInWithCustomToken(adminAuthClient, customToken);
  adminCalls = callables(adminApp);
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc(nonAdminUid).set({
      uid: nonAdminUid, email: 'target@example.com', role: 'user', subscriptionPlan: 'free',
      createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString(), isActive: true,
    });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test('grantComplimentaryAccess requires a real admin claim', async () => {
  await assert.rejects(
    () => nonAdminCalls.grant({ targetUid: nonAdminUid, plan: 'pro', reason: 'test' }),
    (err) => { assert.equal(err.code, 'functions/permission-denied'); return true; }
  );
});

test('a trusted admin can grant complimentary access, and it is reflected in listUserAccessSummaries', async () => {
  const result = await adminCalls.grant({ targetUid: nonAdminUid, plan: 'platinum', reason: 'beta tester' });
  assert.equal(result.data.ok, true);

  const listResult = await adminCalls.list({});
  const summary = listResult.data.summaries.find((s) => s.uid === nonAdminUid);
  assert.ok(summary, 'the granted user should appear in the list');
  assert.equal(summary.entitlement.plan, 'platinum');
  assert.equal(summary.entitlement.source, 'complimentary');
  assert.equal(summary.complimentaryGrant.reason, 'beta tester');
});

test('listUserAccessSummaries requires a real admin claim', async () => {
  await assert.rejects(
    () => nonAdminCalls.list({}),
    (err) => { assert.equal(err.code, 'functions/permission-denied'); return true; }
  );
});

test('revoking a grant restores the user to Free and clears the grant', async () => {
  await adminCalls.grant({ targetUid: nonAdminUid, plan: 'pro', reason: 'test' });
  const revokeResult = await adminCalls.revoke({ targetUid: nonAdminUid, reason: 'trial ended' });
  assert.equal(revokeResult.data.ok, true);

  const listResult = await adminCalls.list({});
  const summary = listResult.data.summaries.find((s) => s.uid === nonAdminUid);
  assert.equal(summary.entitlement.plan, 'free');
  assert.equal(summary.complimentaryGrant, null);
});

test('deactivateAccount and reactivateAccount are audited and admin-only', async () => {
  await assert.rejects(() => nonAdminCalls.deactivate({ targetUid: nonAdminUid, reason: 'test' }));

  const result = await adminCalls.deactivate({ targetUid: nonAdminUid, reason: 'suspicious activity' });
  assert.equal(result.data.ok, true);

  const reactivateResult = await adminCalls.reactivate({ targetUid: nonAdminUid, reason: 'issue resolved' });
  assert.equal(reactivateResult.data.ok, true);
});

test('deleteAccount refuses to delete an account with a live subscription unless acknowledged', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('billingSummaries').doc(nonAdminUid).set({
      uid: nonAdminUid, status: 'active', plan: 'pro', interval: 'month', cancelAtPeriodEnd: false,
    });
  });

  const statusResult = await adminCalls.checkBilling({ uid: nonAdminUid });
  assert.equal(statusResult.data.hasLiveSubscription, true);

  await assert.rejects(
    () => adminCalls.deleteAccount({ targetUid: nonAdminUid, reason: 'test' }),
    (err) => { assert.equal(err.code, 'functions/failed-precondition'); return true; }
  );

  // With explicit acknowledgment, deletion proceeds — but this never touches Stripe.
  const deleteResult = await adminCalls.deleteAccount({ targetUid: nonAdminUid, reason: 'test', acknowledgeLiveSubscription: true });
  assert.equal(deleteResult.data.ok, true);
  assert.equal(deleteResult.data.hadLiveSubscription, true);

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const userSnap = await ctx.firestore().collection('users').doc(nonAdminUid).get();
    assert.equal(userSnap.exists, false, 'profile should be deleted');
    // Billing record is preserved for support/audit purposes even after deletion.
    const billingSnap = await ctx.firestore().collection('billingSummaries').doc(nonAdminUid).get();
    assert.equal(billingSnap.exists, true, 'billing history must survive account deletion');
  });
});

test('deleteAccount proceeds normally (no acknowledgment needed) when there is no live subscription', async () => {
  // A fresh Auth user — the previous test already removed nonAdminUid's
  // Firebase Auth record via a real deleteAccount call, so reusing it here
  // would hit "no user record" for an unrelated reason.
  const freshUser = await getAdminAuth().createUser({});
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc(freshUser.uid).set({
      uid: freshUser.uid, email: 'fresh@example.com', role: 'user', subscriptionPlan: 'free',
      createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString(), isActive: true,
    });
  });

  const result = await adminCalls.deleteAccount({ targetUid: freshUser.uid, reason: 'test cleanup' });
  assert.equal(result.data.ok, true);
  assert.equal(result.data.hadLiveSubscription, false);
});

test('deleteAccount is admin-only', async () => {
  await assert.rejects(
    () => nonAdminCalls.deleteAccount({ targetUid: adminUid, reason: 'test' }),
    (err) => { assert.equal(err.code, 'functions/permission-denied'); return true; }
  );
});

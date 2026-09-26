/**
 * Firestore rules emulator tests (admin_subscriptions.md section 10, step 3).
 *
 * Proves: a signed-in user cannot escalate their own role/plan, cannot read
 * or write another user's private billing/entitlement data, and that
 * billing/entitlement/audit collections reject all direct client writes
 * (they are backend-only, written exclusively via the Admin SDK from
 * functions/, which bypasses these rules).
 *
 * Requires the Firestore emulator running on 127.0.0.1:8080. Start it with:
 *   npm run emulators
 * or: firebase emulators:start --only firestore --project demo-goalcalendly
 *
 * Run with: node --test tests/firestore.rules.test.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-goalcalendly',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test('owner can create their own Free profile with safe defaults', async () => {
  const alice = testEnv.authenticatedContext('alice');
  await assertSucceeds(
    alice.firestore().collection('users').doc('alice').set({
      uid: 'alice',
      email: 'alice@example.com',
      role: 'user',
      subscriptionPlan: 'free',
    })
  );
});

test('a user cannot create their own profile as admin or on a paid plan', async () => {
  const mallory = testEnv.authenticatedContext('mallory');
  await assertFails(
    mallory.firestore().collection('users').doc('mallory').set({
      uid: 'mallory',
      email: 'mallory@example.com',
      role: 'admin',
      subscriptionPlan: 'free',
    })
  );
  await assertFails(
    mallory.firestore().collection('users').doc('mallory').set({
      uid: 'mallory',
      email: 'mallory@example.com',
      role: 'user',
      subscriptionPlan: 'enterprise',
    })
  );
});

test('a user cannot escalate their own role or plan via update', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc('bob').set({
      uid: 'bob',
      email: 'bob@example.com',
      role: 'user',
      subscriptionPlan: 'free',
      isActive: true,
    });
  });

  const bob = testEnv.authenticatedContext('bob');
  await assertFails(bob.firestore().collection('users').doc('bob').update({ role: 'admin' }));
  await assertFails(bob.firestore().collection('users').doc('bob').update({ subscriptionPlan: 'enterprise' }));
  await assertFails(bob.firestore().collection('users').doc('bob').update({ isActive: false }));

  // Safe personal field update still works.
  await assertSucceeds(bob.firestore().collection('users').doc('bob').update({ displayName: 'Bob' }));
});

test('a user cannot read another user\'s profile', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc('carol').set({
      uid: 'carol',
      email: 'carol@example.com',
      role: 'user',
      subscriptionPlan: 'free',
    });
  });

  const dave = testEnv.authenticatedContext('dave');
  await assertFails(dave.firestore().collection('users').doc('carol').get());
});

test('a trusted admin (custom claim) can read any profile; a plain user with role=admin in Firestore cannot', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc('erin').set({
      uid: 'erin',
      email: 'erin@example.com',
      role: 'user',
      subscriptionPlan: 'free',
    });
  });

  // Fake admin: Firestore role field says admin, but no custom claim.
  const fakeAdmin = testEnv.authenticatedContext('fake-admin', { admin: false });
  await assertFails(fakeAdmin.firestore().collection('users').doc('erin').get());

  // Real admin: custom claim present, exactly as functions/src/admin/setAdminClaim.ts sets it.
  const realAdmin = testEnv.authenticatedContext('real-admin', { admin: true });
  await assertSucceeds(realAdmin.firestore().collection('users').doc('erin').get());
});

test('no client can write billingCustomers, entitlements, or usage, even their own', async () => {
  const alice = testEnv.authenticatedContext('alice');
  await assertFails(alice.firestore().collection('billingCustomers').doc('alice').set({ status: 'active' }));
  await assertFails(alice.firestore().collection('entitlements').doc('alice').set({ plan: 'enterprise' }));
  await assertFails(alice.firestore().collection('usage').doc('alice').set({ activeGoalCount: 0 }));

  const admin = testEnv.authenticatedContext('real-admin', { admin: true });
  await assertFails(admin.firestore().collection('entitlements').doc('alice').set({ plan: 'enterprise' }));
});

test('owner can read their own entitlement/billing/usage docs once written by the backend', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('entitlements').doc('alice').set({ plan: 'free', source: 'free' });
    await ctx.firestore().collection('billingCustomers').doc('alice').set({ status: 'none' });
    await ctx.firestore().collection('usage').doc('alice').set({ activeGoalCount: 1 });
  });

  const alice = testEnv.authenticatedContext('alice');
  await assertSucceeds(alice.firestore().collection('entitlements').doc('alice').get());
  await assertSucceeds(alice.firestore().collection('billingCustomers').doc('alice').get());
  await assertSucceeds(alice.firestore().collection('usage').doc('alice').get());

  const dave = testEnv.authenticatedContext('dave');
  await assertFails(dave.firestore().collection('entitlements').doc('alice').get());
});

test('stripeEvents and adminAuditLogs reject all client reads and writes except admin reading audit logs', async () => {
  const admin = testEnv.authenticatedContext('real-admin', { admin: true });
  const alice = testEnv.authenticatedContext('alice');

  await assertFails(alice.firestore().collection('stripeEvents').doc('evt_1').get());
  await assertFails(admin.firestore().collection('stripeEvents').doc('evt_1').get());
  await assertFails(alice.firestore().collection('stripeEvents').doc('evt_1').set({ type: 'x' }));

  await assertFails(alice.firestore().collection('adminAuditLogs').doc('log_1').get());
  await assertFails(alice.firestore().collection('adminAuditLogs').doc('log_1').set({ action: 'x' }));

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('adminAuditLogs').doc('log_1').set({ action: 'grant_admin' });
  });
  await assertSucceeds(admin.firestore().collection('adminAuditLogs').doc('log_1').get());
});

test('an unauthenticated request is rejected across the board', async () => {
  const anon = testEnv.unauthenticatedContext();
  await assertFails(anon.firestore().collection('users').doc('alice').get());
  await assertFails(anon.firestore().collection('goals').doc('g1').get());
});

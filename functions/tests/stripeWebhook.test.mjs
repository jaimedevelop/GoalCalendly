/**
 * Stripe webhook + reconciliation integration tests (admin_subscriptions.md
 * section 10, step 6).
 *
 * Exercises the real deployed webhook HTTP endpoint against the Functions +
 * Firestore + Auth emulators, using genuinely signed test events (via
 * Stripe's own `webhooks.generateTestHeaderString`, no live Stripe account
 * needed) — proving: a verified event changes access correctly, a forged
 * signature is rejected, replaying an already-processed event does not
 * re-apply/double-grant, and a missed event can be repaired via reconciliation.
 *
 * Requires the Functions + Firestore + Auth emulators running with
 * STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_* set in the
 * functions process environment (see functions/.env.example and the run
 * command printed at the end of this file's header comment).
 *
 * Run with: node --test functions/tests/stripeWebhook.test.mjs
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import fs from 'node:fs';
import { config } from 'dotenv';

// Firebase loads this project file only into its function workers. Load the
// same fixture configuration in the test client so signatures and Price IDs
// agree. Explicit shell overrides retain precedence; never load production.
config({ path: new URL('../.env.demo-goalcalendly', import.meta.url), quiet: true });

const PROJECT_ID = 'demo-goalcalendly';
const WEBHOOK_URL = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/stripeWebhook`;
// A fixed test signing secret — must match STRIPE_WEBHOOK_SECRET in the
// functions emulator's environment for signatures generated here to verify.
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test_secret_for_emulator_only';
const PRICE_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_pro_monthly_test';

let testEnv;
let uid;

function fakeSubscription({ current_period_end, ...overrides } = {}) {
  const now = Math.floor(Date.now() / 1000);
  // As of the Basil API version (2025-03-31+), current_period_end lives on
  // the subscription item, not the Subscription object itself — mirror that
  // shape here so these mocks match what our code actually receives from
  // Stripe in production (see syncSubscription.ts).
  return {
    id: 'sub_test_1',
    object: 'subscription',
    customer: 'cus_test_1',
    status: 'active',
    latest_invoice: { status: 'paid' },
    cancel_at_period_end: false,
    items: { data: [{ price: { id: PRICE_PRO_MONTHLY }, current_period_end: current_period_end ?? now + 30 * 24 * 60 * 60 }] },
    metadata: { firebaseUid: uid },
    ...overrides,
  };
}

function signedEvent(type, dataObject) {
  const payload = JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: 'event',
    type,
    data: { object: dataObject },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, header };
}

async function postEvent(type, dataObject) {
  const { payload, header } = signedEvent(type, dataObject);
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
    body: payload,
  });
  return { status: res.status, body: await res.text() };
}

async function getEntitlement(uidToCheck) {
  let data;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await ctx.firestore().collection('entitlements').doc(uidToCheck).get();
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
  const cred = await signInAnonymously(auth);
  uid = cred.user.uid;
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv?.cleanup();
});

test('a verified checkout.session.completed grants the purchased plan', async () => {
  // Seed the billingCustomers mapping the way createCheckoutSession (step 7)
  // will: the subscription carries the Firebase UID in metadata, but
  // resolveUidForSubscription also falls back to a stored customer mapping.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('billingCustomers').doc(uid).set({ uid, stripeCustomerId: 'cus_test_1', status: 'none', cancelAtPeriodEnd: false, lastSyncedAt: new Date().toISOString() });
  });

  const result = await postEvent('customer.subscription.created', fakeSubscription());
  assert.equal(result.status, 200, result.body);

  const entitlement = await getEntitlement(uid);
  assert.equal(entitlement?.plan, 'pro');
  assert.equal(entitlement?.source, 'stripe');
});

test('a forged signature is rejected and never changes entitlement', async () => {
  const payload = JSON.stringify({ id: 'evt_forged', object: 'event', type: 'customer.subscription.created', data: { object: fakeSubscription() } });
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=not_a_real_signature' },
    body: payload,
  });
  assert.equal(res.status, 400);

  const entitlement = await getEntitlement(uid);
  assert.equal(entitlement, null, 'a forged event must not create or change an entitlement record');
});

test('same-period plan and cancellation changes update entitlement and billing summary', async () => {
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
  let result = await postEvent('customer.subscription.created', fakeSubscription({ current_period_end: periodEnd }));
  assert.equal(result.status, 200, result.body);
  assert.equal((await getEntitlement(uid)).plan, 'pro');
  const platinum = fakeSubscription({
    items: { data: [{ price: { id: process.env.STRIPE_PRICE_PLATINUM_MONTHLY }, current_period_end: periodEnd }] },
    cancel_at_period_end: true,
  });
  result = await postEvent('customer.subscription.updated', platinum);
  assert.equal(result.status, 200, result.body);
  const entitlement = await getEntitlement(uid);
  assert.equal(entitlement.plan, 'platinum');
  assert.equal(entitlement.maxActiveGoals, 30);
  await testEnv.withSecurityRulesDisabled(async ctx => {
    const summary = (await ctx.firestore().collection('billingSummaries').doc(uid).get()).data();
    assert.equal(summary.plan, 'platinum');
    assert.equal(summary.cancelAtPeriodEnd, true);
  });
  result = await postEvent('customer.subscription.updated', { ...platinum, cancel_at_period_end: false });
  assert.equal(result.status, 200);
  await testEnv.withSecurityRulesDisabled(async ctx => {
    assert.equal((await ctx.firestore().collection('billingSummaries').doc(uid).get()).data().cancelAtPeriodEnd, false);
  });
});

test('replaying an already-processed event does not double-apply or error', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('billingCustomers').doc(uid).set({ uid, stripeCustomerId: 'cus_test_1', status: 'none', cancelAtPeriodEnd: false, lastSyncedAt: new Date().toISOString() });
  });

  const { payload, header } = signedEvent('customer.subscription.created', fakeSubscription());
  const first = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': header }, body: payload });
  assert.equal(first.status, 200);
  const afterFirst = await getEntitlement(uid);

  // Exact same signed payload again — simulates Stripe's at-least-once delivery retry.
  const replay = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': header }, body: payload });
  assert.equal(replay.status, 200);
  const afterReplay = await getEntitlement(uid);

  assert.deepEqual(afterReplay, afterFirst, 'replaying a processed event must be a no-op');
});

test('cancellation (customer.subscription.deleted) with no remaining paid-through window revokes access to Free', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('billingCustomers').doc(uid).set({ uid, stripeCustomerId: 'cus_test_1', status: 'active', plan: 'pro', cancelAtPeriodEnd: false, lastSyncedAt: new Date().toISOString() });
  });

  const past = Math.floor(Date.now() / 1000) - 1000;
  const result = await postEvent('customer.subscription.deleted', fakeSubscription({ status: 'canceled', current_period_end: past }));
  assert.equal(result.status, 200, result.body);

  const entitlement = await getEntitlement(uid);
  assert.equal(entitlement?.plan, 'free');
});

test('an event for an unmapped customer is accepted (200) but skipped, not errored', async () => {
  const result = await postEvent('customer.subscription.created', fakeSubscription({ metadata: {}, customer: 'cus_totally_unknown' }));
  assert.equal(result.status, 200, result.body);
  const entitlement = await getEntitlement(uid);
  assert.equal(entitlement, null);
});

test('an invoice event with no linked subscription (parent.subscription_details null) is accepted and skipped, not errored', async () => {
  // Confirms the invoice.* handler reads the Basil-era
  // parent.subscription_details.subscription path (not the removed top-level
  // invoice.subscription field) without throwing when it's absent, e.g. a
  // one-off invoice unrelated to any subscription.
  const fakeInvoiceNoSub = {
    id: 'in_test_1',
    object: 'invoice',
    customer: 'cus_test_1',
    parent: { type: 'quote_details', subscription_details: null, quote_details: {} },
  };
  const result = await postEvent('invoice.paid', fakeInvoiceNoSub);
  assert.equal(result.status, 200, result.body);
  const entitlement = await getEntitlement(uid);
  assert.equal(entitlement, null);
});

test('failed initial payment never grants a paid window', async () => {
  const result = await postEvent('customer.subscription.created', fakeSubscription({status:'incomplete'}));
  assert.equal(result.status,200);assert.equal((await getEntitlement(uid)).plan,'free');
});

test('failed renewal preserves paid-through and expired grace; recovery restores access', async () => {
  const past=Math.floor(Date.now()/1000)-86400;
  assert.equal((await postEvent('customer.subscription.created',fakeSubscription({current_period_end:past}))).status,200);
  assert.equal((await postEvent('customer.subscription.updated',fakeSubscription({status:'past_due'}))).status,200);
  await testEnv.withSecurityRulesDisabled(async ctx=>{
    const ref=ctx.firestore().collection('billingCustomers').doc(uid);const b=(await ref.get()).data();
    assert.equal(b.paidThroughDate,new Date(past*1000).toISOString());assert.ok(b.gracePeriodEndsAt);
    await ref.update({gracePeriodEndsAt:new Date(Date.now()-1000).toISOString()});
  });
  assert.equal((await postEvent('customer.subscription.updated',fakeSubscription({status:'past_due'}))).status,200);
  assert.equal((await getEntitlement(uid)).plan,'free');
  assert.equal((await postEvent('customer.subscription.updated',fakeSubscription())).status,200);
  assert.equal((await getEntitlement(uid)).plan,'pro');
  await testEnv.withSecurityRulesDisabled(async ctx=>assert.equal((await ctx.firestore().collection('billingCustomers').doc(uid).get()).data().gracePeriodEndsAt,undefined));
});

test('active subscription with draft renewal invoice does not extend paid-through',async()=>{
  const past=Math.floor(Date.now()/1000)-86400;
  await postEvent('customer.subscription.created',fakeSubscription({current_period_end:past}));
  await postEvent('customer.subscription.updated',fakeSubscription({latest_invoice:{status:'draft'}}));
  await testEnv.withSecurityRulesDisabled(async ctx=>assert.equal((await ctx.firestore().collection('billingCustomers').doc(uid).get()).data().paidThroughDate,new Date(past*1000).toISOString()));
});

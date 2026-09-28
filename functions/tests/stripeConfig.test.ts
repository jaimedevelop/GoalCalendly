import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { verifyPrice, verifyWebhookEndpoint } from '../scripts/verifyStripeConfig.ts';

process.argv.push('--env', 'live');
const url = 'https://us-central1-goal-calendly.cloudfunctions.net/stripeWebhook';
function client(endpoints: unknown[]) {
  return { webhookEndpoints: { list: async function* () { yield* endpoints; } } } as unknown as Stripe;
}
test('verifier accepts the exact Functions endpoint independently of the website origin', async () => {
  const failures: { check: string; detail: string }[] = [];
  await verifyWebhookEndpoint(client([{ url, status: 'enabled', livemode: true, enabled_events: ['*'] }]), failures, url);
  assert.deepEqual(failures, []);
});
test('verifier rejects a lookalike endpoint, disabled endpoint, wrong mode and missing events', async () => {
  const failures: { check: string; detail: string }[] = [];
  await verifyWebhookEndpoint(client([{ url: url + '/wrong', status: 'enabled', livemode: true, enabled_events: ['*'] }]), failures, url);
  assert.match(failures[0].detail, /No registered endpoint/);
  failures.length = 0;
  await verifyWebhookEndpoint(client([{ url, status: 'disabled', livemode: false, enabled_events: [] }]), failures, url);
  assert.equal(failures.length, 9); // mode, status, seven required events
});
test('verifier rejects a test-mode price and a multi-month recurrence for a live monthly plan', async () => {
  process.env.STRIPE_AUDIT_TEST_PRICE = 'price_fixture';
  const stripe = { prices: { retrieve: async () => ({ active: true, livemode: false, currency: 'usd', unit_amount: 499, recurring: { interval: 'month', interval_count: 3 } }) } } as unknown as Stripe;
  const failures: { check: string; detail: string }[] = [];
  try {
    await verifyPrice(stripe, failures, 'Pro', 'STRIPE_AUDIT_TEST_PRICE', 499, 'month', 'usd');
    assert.equal(failures.length, 2);
  } finally {
    delete process.env.STRIPE_AUDIT_TEST_PRICE;
  }
});

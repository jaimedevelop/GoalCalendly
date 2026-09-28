#!/usr/bin/env node
/**
 * Checks resource environment, currency, interval, amounts, active state,
 * and endpoint configuration before enabling Checkout (admin_subscriptions.md
 * section 4/8, step 5's completion check).
 *
 * Usage (run from functions/, after `npm run build`):
 *   STRIPE_SECRET_KEY=rk_test_... \
 *   STRIPE_PRICE_PRO_MONTHLY=price_... STRIPE_PRICE_PRO_ANNUAL=price_... \
 *   STRIPE_PRICE_PLATINUM_MONTHLY=price_... STRIPE_PRICE_PLATINUM_ANNUAL=price_... \
 *   STRIPE_PORTAL_CONFIGURATION_ID=bpc_... \
 *   npx tsx scripts/verifyStripeConfig.ts --env test
 *
 * This does not create, modify, or delete anything — read-only checks only.
 * Exits non-zero (and prints every failure, not just the first) if any
 * configured Price/Portal ID doesn't match what the app catalog expects, so
 * Checkout is never enabled against a misconfigured or mismatched account.
 */
import Stripe from 'stripe';
import { pathToFileURL } from 'node:url';
import { SUBSCRIPTION_PLANS } from '../../shared/subscriptionPlans.js';

function parseEnvFlag(): 'test' | 'live' {
  const idx = process.argv.indexOf('--env');
  const value = idx >= 0 ? process.argv[idx + 1] : undefined;
  if (value !== 'test' && value !== 'live') {
    throw new Error('Pass --env test or --env live explicitly.');
  }
  return value;
}

function assertKeyMatchesEnv(secretKey: string, env: 'test' | 'live') {
  const isTestKey = /^(sk|rk)_test_/.test(secretKey);
  const isLiveKey = /^(sk|rk)_live_/.test(secretKey);
  if (env === 'test' && !isTestKey) throw new Error('STRIPE_SECRET_KEY is not a test key, but --env test was passed.');
  if (env === 'live' && !isLiveKey) throw new Error('STRIPE_SECRET_KEY is not a live key, but --env live was passed.');
}

interface Failure {
  check: string;
  detail: string;
}

export async function verifyPrice(
  stripe: Stripe,
  failures: Failure[],
  label: string,
  envVar: string,
  expectedAmountCents: number,
  expectedInterval: 'month' | 'year',
  expectedCurrency: string
) {
  const priceId = process.env[envVar];
  if (!priceId) {
    failures.push({ check: label, detail: `${envVar} is not set.` });
    return;
  }

  let price: Stripe.Price;
  try {
    price = await stripe.prices.retrieve(priceId);
  } catch (err) {
    failures.push({ check: label, detail: `Could not retrieve ${priceId}: ${(err as Error).message}` });
    return;
  }

  if (!price.active) failures.push({ check: label, detail: `${priceId} is not active.` });
  if (price.livemode !== (parseEnvFlag() === 'live')) failures.push({ check: label, detail: 'Price belongs to the wrong Stripe environment.' });
  if (price.recurring?.interval_count !== 1) failures.push({ check: label, detail: 'Price must recur every one month or year.' });
  if (price.currency !== expectedCurrency) {
    failures.push({ check: label, detail: `${priceId} currency is ${price.currency}, expected ${expectedCurrency}.` });
  }
  if (price.recurring?.interval !== expectedInterval) {
    failures.push({ check: label, detail: `${priceId} interval is ${price.recurring?.interval}, expected ${expectedInterval}.` });
  }
  if (price.unit_amount !== expectedAmountCents) {
    failures.push({ check: label, detail: `${priceId} amount is ${price.unit_amount}, expected ${expectedAmountCents}.` });
  }
}

async function verifyPortal(stripe: Stripe, failures: Failure[]) {
  const portalId = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  if (!portalId) {
    failures.push({ check: 'portal', detail: 'STRIPE_PORTAL_CONFIGURATION_ID is not set.' });
    return;
  }
  try {
    const config = await stripe.billingPortal.configurations.retrieve(portalId);
    if (!config.active) failures.push({ check: 'portal', detail: `${portalId} exists but is not active.` });
    if (config.livemode !== (parseEnvFlag() === 'live')) failures.push({ check: 'portal', detail: 'Portal belongs to the wrong Stripe environment.' });
  } catch (err) {
    failures.push({ check: 'portal', detail: `Could not retrieve ${portalId}: ${(err as Error).message}` });
  }
}

export async function verifyWebhookEndpoint(stripe: Stripe, failures: Failure[], webhookUrl: string) {
  const expected = new URL(webhookUrl);
  if (expected.protocol !== 'https:') throw new Error('STRIPE_WEBHOOK_URL must use HTTPS.');
  const relevant: Stripe.WebhookEndpoint[] = [];
  for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 })) {
    if (new URL(endpoint.url).href === expected.href) relevant.push(endpoint);
  }
  if (relevant.length === 0) {
    failures.push({ check: 'webhook', detail: `No registered endpoint matches STRIPE_WEBHOOK_URL (${expected.href}).` });
    return;
  }
  for (const endpoint of relevant) {
    if (endpoint.livemode !== (parseEnvFlag() === 'live')) failures.push({ check: 'webhook', detail: 'Endpoint belongs to the wrong Stripe environment.' });
    for (const event of ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required']) {
      if (!endpoint.enabled_events.includes('*') && !endpoint.enabled_events.includes(event)) {
        failures.push({ check: 'webhook', detail: `Endpoint is missing ${event}.` });
      }
    }
    if (endpoint.status !== 'enabled') {
      failures.push({ check: 'webhook', detail: `Endpoint ${endpoint.url} status is ${endpoint.status}, expected enabled.` });
    }
  }
}

async function main() {
  const env = parseEnvFlag();
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('Set STRIPE_SECRET_KEY in the environment before running this script.');
  assertKeyMatchesEnv(secretKey, env);

  const currency = process.env.STRIPE_CURRENCY ?? 'usd';
  const stripe = new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' });
  const failures: Failure[] = [];

  const pro = SUBSCRIPTION_PLANS.pro;
  const platinum = SUBSCRIPTION_PLANS.platinum;
  if (pro.monthlyPrice == null || pro.annualPrice == null || platinum.monthlyPrice == null || platinum.annualPrice == null) {
    throw new Error('Pro/Platinum prices are not fully configured in shared/subscriptionPlans.ts.');
  }

  await verifyPrice(stripe, failures, 'pro monthly', 'STRIPE_PRICE_PRO_MONTHLY', Math.round(pro.monthlyPrice * 100), 'month', currency);
  await verifyPrice(stripe, failures, 'pro annual', 'STRIPE_PRICE_PRO_ANNUAL', Math.round(pro.annualPrice * 100), 'year', currency);
  await verifyPrice(stripe, failures, 'platinum monthly', 'STRIPE_PRICE_PLATINUM_MONTHLY', Math.round(platinum.monthlyPrice * 100), 'month', currency);
  await verifyPrice(stripe, failures, 'platinum annual', 'STRIPE_PRICE_PLATINUM_ANNUAL', Math.round(platinum.annualPrice * 100), 'year', currency);
  await verifyPortal(stripe, failures);

  // The webhook is hosted by Functions, independently of the frontend origin.
  if (process.env.STRIPE_WEBHOOK_URL) {
    await verifyWebhookEndpoint(stripe, failures, process.env.STRIPE_WEBHOOK_URL);
  } else if (env === 'live') {
    failures.push({ check: 'webhook', detail: 'STRIPE_WEBHOOK_URL is required for live release verification.' });
  } else {
    console.log('Webhook check skipped: set STRIPE_WEBHOOK_URL after deploying the test endpoint.');
  }

  if (failures.length > 0) {
    console.error(`Stripe configuration verification FAILED for env=${env} (${failures.length} issue(s)):`);
    for (const f of failures) console.error(`  - [${f.check}] ${f.detail}`);
    process.exit(1);
  }

  console.log(`Stripe configuration verification passed for env=${env}, currency=${currency}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((err) => {
  console.error('Verification errored:', err.message ?? err);
  process.exit(1);
});

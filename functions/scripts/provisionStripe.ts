#!/usr/bin/env node
/**
 * Idempotent provisioning of Stripe Products, Prices, and a Customer Portal
 * configuration for an explicitly selected environment (admin_subscriptions.md
 * section 8, step 5).
 *
 * Usage (run from functions/, after `npm run build`):
 *   STRIPE_SECRET_KEY=rk_test_... node --experimental-strip-types scripts/provisionStripe.ts --env test
 *
 * Safety:
 * - Requires an explicit --env test|live flag. There is no default, so a
 *   forgotten flag cannot accidentally provision the wrong environment.
 * - Refuses to run if the supplied key's mode ("test/live", per Stripe's own
 *   key prefix) does not match --env, so a copy-paste mistake fails loudly.
 * - Looks up existing resources by a stable `app=goal-calendly` metadata tag
 *   before creating anything, and reuses a match only when its configuration
 *   (amount, currency, interval) agrees; an ambiguous or conflicting match
 *   makes the script fail rather than guess.
 * - In live mode, only Products/Prices/Portal config are created — no
 *   Customers, Checkout Sessions, or Subscriptions are ever created by this
 *   script (admin_subscriptions.md section 8: "Do not create sample
 *   customers or subscriptions in live mode as part of bulk provisioning").
 * - Writes the resulting IDs to config/stripe-resources.<env>.json (non-secret;
 *   see config/stripe-resources.example.json for the schema). Never writes
 *   the API key anywhere.
 *
 * Pricing used here reads shared/subscriptionPlans.ts, which currently holds
 * the recommended-but-unconfirmed $4.99/$9.99 proposal (see
 * STEP1_BASELINE.md open item: launch pricing is not yet finalized). Confirm
 * pricing before running this against a real account you intend to keep.
 */
import Stripe from 'stripe';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBSCRIPTION_PLANS } from '../../shared/subscriptionPlans.js';

const APP_TAG = 'goal-calendly';

interface PlanPriceSpec {
  plan: 'pro' | 'platinum';
  productName: string;
  monthlyCents: number;
  annualCents: number;
}

function planSpecs(): PlanPriceSpec[] {
  const specs: PlanPriceSpec[] = [];
  for (const id of ['pro', 'platinum'] as const) {
    const def = SUBSCRIPTION_PLANS[id];
    if (def.monthlyPrice == null || def.annualPrice == null) {
      throw new Error(`${id} has no numeric price configured; cannot provision.`);
    }
    specs.push({
      plan: id,
      productName: `Goal Calendly ${def.displayName}`,
      monthlyCents: Math.round(def.monthlyPrice * 100),
      annualCents: Math.round(def.annualPrice * 100),
    });
  }
  return specs;
}

function parseArgs(): { env: 'test' | 'live' } {
  const envArg = process.argv.find((a) => a.startsWith('--env'));
  const value = envArg?.includes('=') ? envArg.split('=')[1] : process.argv[process.argv.indexOf('--env') + 1];
  if (value !== 'test' && value !== 'live') {
    throw new Error('Pass --env test or --env live explicitly. There is no default.');
  }
  return { env: value };
}

function assertKeyMatchesEnv(secretKey: string, env: 'test' | 'live') {
  const isTestKey = secretKey.includes('_test_');
  const isLiveKey = secretKey.includes('_live_');
  if (env === 'test' && !isTestKey) {
    throw new Error('STRIPE_SECRET_KEY does not look like a test/sandbox key, but --env test was passed.');
  }
  if (env === 'live' && !isLiveKey) {
    throw new Error('STRIPE_SECRET_KEY does not look like a live key, but --env live was passed.');
  }
}

async function findExistingProduct(stripe: Stripe, plan: string): Promise<Stripe.Product | null> {
  const products = await stripe.products.search({ query: `metadata['app']:'${APP_TAG}' AND metadata['plan']:'${plan}'` });
  if (products.data.length > 1) {
    throw new Error(`Ambiguous match: found ${products.data.length} products tagged plan=${plan}. Resolve manually before re-running.`);
  }
  return products.data[0] ?? null;
}

async function findExistingPrice(
  stripe: Stripe,
  productId: string,
  interval: 'month' | 'year',
  expectedAmount: number,
  expectedCurrency: string
): Promise<Stripe.Price | null> {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const matches = prices.data.filter((p) => p.recurring?.interval === interval);
  if (matches.length === 0) return null;

  const exact = matches.find((p) => p.unit_amount === expectedAmount && p.currency === expectedCurrency);
  if (exact) return exact;

  throw new Error(
    `Found an existing ${interval} price on product ${productId} that does NOT match the expected amount/currency ` +
    `(expected ${expectedAmount} ${expectedCurrency}, found ${matches.map((p) => `${p.unit_amount} ${p.currency}`).join(', ')}). ` +
    `A price change requires a new Price and an explicit existing-subscriber policy — see admin_subscriptions.md section 8. Resolve manually.`
  );
}

async function ensureProductAndPrices(stripe: Stripe, spec: PlanPriceSpec, currency: string) {
  let product = await findExistingProduct(stripe, spec.plan);
  if (!product) {
    product = await stripe.products.create({
      name: spec.productName,
      metadata: { app: APP_TAG, plan: spec.plan },
    });
    console.log(`Created product ${product.id} (${spec.productName})`);
  } else {
    console.log(`Reusing existing product ${product.id} (${spec.productName})`);
  }

  let monthlyPrice = await findExistingPrice(stripe, product.id, 'month', spec.monthlyCents, currency);
  if (!monthlyPrice) {
    monthlyPrice = await stripe.prices.create({
      product: product.id,
      currency,
      unit_amount: spec.monthlyCents,
      recurring: { interval: 'month' },
      metadata: { app: APP_TAG, plan: spec.plan, interval: 'month' },
    });
    console.log(`Created monthly price ${monthlyPrice.id} (${spec.monthlyCents} ${currency})`);
  } else {
    console.log(`Reusing existing monthly price ${monthlyPrice.id}`);
  }

  let annualPrice = await findExistingPrice(stripe, product.id, 'year', spec.annualCents, currency);
  if (!annualPrice) {
    annualPrice = await stripe.prices.create({
      product: product.id,
      currency,
      unit_amount: spec.annualCents,
      recurring: { interval: 'year' },
      metadata: { app: APP_TAG, plan: spec.plan, interval: 'year' },
    });
    console.log(`Created annual price ${annualPrice.id} (${spec.annualCents} ${currency})`);
  } else {
    console.log(`Reusing existing annual price ${annualPrice.id}`);
  }

  return { productId: product.id, monthlyPriceId: monthlyPrice.id, annualPriceId: annualPrice.id };
}

async function ensurePortalConfiguration(
  stripe: Stripe,
  planProducts: { productId: string; monthlyPriceId: string; annualPriceId: string }[]
): Promise<string> {
  const existing = await stripe.billingPortal.configurations.list({ limit: 100 });
  const tagged = existing.data.find((c) => c.metadata?.app === APP_TAG);
  if (tagged) {
    console.log(`Reusing existing Portal configuration ${tagged.id}`);
    return tagged.id;
  }

  // Stripe requires an explicit product/price allowlist for self-service
  // plan changes — this lets a customer switch between Pro and Platinum
  // (either billing interval) but not onto some unrelated Price.
  const allowedProducts = planProducts.map((p) => ({
    product: p.productId,
    prices: [p.monthlyPriceId, p.annualPriceId],
  }));

  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'Goal Calendly' },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: allowedProducts,
      },
    },
    metadata: { app: APP_TAG },
  });
  console.log(`Created Portal configuration ${created.id}`);
  return created.id;
}

async function main() {
  const { env } = parseArgs();
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('Set STRIPE_SECRET_KEY in the environment before running this script.');
  assertKeyMatchesEnv(secretKey, env);

  const currency = process.env.STRIPE_CURRENCY ?? 'usd';
  const stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });

  console.log(`Provisioning Stripe resources for env=${env}, currency=${currency}...`);

  const results: Record<string, unknown> = { env, currency, provisionedAt: new Date().toISOString() };
  const planResults: { productId: string; monthlyPriceId: string; annualPriceId: string }[] = [];

  for (const spec of planSpecs()) {
    const planResult = await ensureProductAndPrices(stripe, spec, currency);
    results[spec.plan] = planResult;
    planResults.push(planResult);
  }

  results.portalConfigurationId = await ensurePortalConfiguration(stripe, planResults);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = join(__dirname, '..', '..', 'config');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `stripe-resources.${env}.json`);
  writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');

  console.log(`\nDone. Non-secret resource inventory written to ${outPath}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('Provisioning failed:', err.message ?? err);
  process.exit(1);
});

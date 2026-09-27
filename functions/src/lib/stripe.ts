/**
 * Stripe client and server-only plan/interval-to-Price mapping.
 *
 * Intentionally minimal placeholder for Step 2 (backend foundation). The
 * checkout/webhook/portal logic that uses this client is implemented in
 * roadmap steps 6-7, once Stripe test resources exist (step 5).
 *
 * Never expose STRIPE_SECRET_KEY or Price ID env vars to the frontend
 * (no VITE_ prefix, ever). See admin_subscriptions.md section 5, step 2.
 */
import Stripe from 'stripe';
import type { SubscriptionPlanId, BillingInterval } from '../../../shared/subscriptionPlans.js';

let stripeClient: Stripe | null = null;

/** Lazily constructs the Stripe client so builds/tests don't require a key. */
export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  stripeClient = new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' });
  return stripeClient;
}

const PRICE_ENV_VARS: Record<Exclude<SubscriptionPlanId, 'free' | 'enterprise'>, Record<BillingInterval, string>> = {
  pro: { month: 'STRIPE_PRICE_PRO_MONTHLY', year: 'STRIPE_PRICE_PRO_ANNUAL' },
  platinum: { month: 'STRIPE_PRICE_PLATINUM_MONTHLY', year: 'STRIPE_PRICE_PLATINUM_ANNUAL' },
};

/**
 * Resolves a purchasable plan + interval to a server-configured Stripe Price
 * ID. Never accept a Price ID directly from the client.
 */
export function resolvePriceId(plan: 'pro' | 'platinum', interval: BillingInterval): string {
  const envVar = PRICE_ENV_VARS[plan][interval];
  const priceId = process.env[envVar];
  if (!priceId) {
    throw new Error(`${envVar} is not configured.`);
  }
  return priceId;
}

/**
 * Reverse lookup: given a Stripe Price ID observed on a subscription (from a
 * webhook event or reconciliation), resolves which app plan/interval it
 * corresponds to. Returns null for an unrecognized Price ID (e.g. an
 * Enterprise custom price, or a stale Price from a previous provisioning) —
 * callers must handle that case rather than assume every subscription maps
 * to a known plan.
 */
export function planFromPriceId(priceId: string): { plan: 'pro' | 'platinum'; interval: BillingInterval } | null {
  for (const plan of Object.keys(PRICE_ENV_VARS) as ('pro' | 'platinum')[]) {
    for (const interval of ['month', 'year'] as BillingInterval[]) {
      if (process.env[PRICE_ENV_VARS[plan][interval]] === priceId) {
        return { plan, interval };
      }
    }
  }
  return null;
}

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
  stripeClient = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
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

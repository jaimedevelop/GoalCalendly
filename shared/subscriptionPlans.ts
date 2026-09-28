/**
 * Shared subscription plan catalog.
 *
 * This is the single source of truth for tier IDs, active-goal limits, and
 * display pricing. Both the frontend (src/) and the backend (functions/)
 * import from this file so the two never drift apart.
 *
 * Do not put Stripe Price IDs or other environment-specific values here —
 * those are resolved server-side from environment configuration (see
 * admin_subscriptions.md section 5, step 2, and functions/src/lib/stripe.ts
 * once implemented). This file only carries the product catalog itself.
 */

export type SubscriptionPlanId = 'free' | 'pro' | 'platinum' | 'enterprise';

export type BillingInterval = 'month' | 'year';

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlanId;
  displayName: string;
  /** Maximum number of active (non-completed) goals. -1 means unlimited. */
  maxActiveGoals: number;
  /** Whether this plan shows advertising. */
  hasAdvertising: boolean;
  /** Whether this plan is purchasable through Stripe Checkout directly. */
  purchasable: boolean;
  /** Display-only monthly price in USD. null means "contact for pricing". */
  monthlyPrice: number | null;
  /** Display-only annual price in USD. null means "contact for pricing". */
  annualPrice: number | null;
  /** Verified feature labels only. Do not list unaudited/aspirational features here. */
  features: string[];
}

/**
 * Pricing decision (see admin_subscriptions.md section 3 and STEP1_BASELINE.md):
 * NOT YET FINALIZED by the product owner. The two proposed options are:
 *   (a) new pricing: Pro $4.99/mo, $49.90/yr; Platinum $9.99/mo, $99.90/yr
 *   (b) keep existing: Pro $3.50/mo, $35/yr; Platinum $9.50/mo, $95/yr
 *
 * The values below are placeholders using option (a), the recommended
 * default from admin_subscriptions.md. Update this file (and re-provision
 * matching Stripe Prices per section 8) once the decision is confirmed.
 */
export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlanDefinition> = {
  free: {
    id: 'free',
    displayName: 'Free',
    maxActiveGoals: 2,
    hasAdvertising: true,
    purchasable: false,
    monthlyPrice: 0,
    annualPrice: 0,
    features: ['Basic goal tracking', 'Timer functionality', 'Progress tracking'],
  },
  pro: {
    id: 'pro',
    displayName: 'Pro',
    maxActiveGoals: 15,
    hasAdvertising: false,
    purchasable: true,
    monthlyPrice: 4.99,
    annualPrice: 49.90,
    features: ['All Free features', 'No advertising'],
  },
  platinum: {
    id: 'platinum',
    displayName: 'Platinum',
    maxActiveGoals: 30,
    hasAdvertising: false,
    purchasable: true,
    monthlyPrice: 9.99,
    annualPrice: 99.90,
    features: ['All Pro features'],
  },
  enterprise: {
    id: 'enterprise',
    displayName: 'Enterprise',
    maxActiveGoals: -1,
    hasAdvertising: false,
    purchasable: false,
    monthlyPrice: null,
    annualPrice: null,
    features: ['All Platinum features', 'Custom pricing — contact sales'],
  },
};

export function getPlan(id: SubscriptionPlanId): SubscriptionPlanDefinition {
  return SUBSCRIPTION_PLANS[id];
}

/** Active goals count against the limit; completed goals never do. */
export function isGoalActive(goal: { completed?: boolean }): boolean {
  return goal.completed !== true;
}

export function isUnderActiveGoalLimit(plan: SubscriptionPlanId, currentActiveCount: number): boolean {
  const limit = SUBSCRIPTION_PLANS[plan].maxActiveGoals;
  if (limit < 0) return true; // unlimited
  return currentActiveCount < limit;
}

/** Public contact destination confirmed by the product owner. */
export const ENTERPRISE_CONTACT_EMAIL = 'ezboss.business@gmail.com';

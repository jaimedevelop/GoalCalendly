/**
 * Effective-access calculation (admin_subscriptions.md section 5, "Proposed
 * application policy" table). This is the single place that turns raw
 * billing/grant/claim state into the plan a user actually gets. Both the
 * webhook sync (step 6) and admin grant actions (step 9) call this after
 * writing their own source-of-truth record, and reconciliation re-derives it
 * on schedule so a missed event can't leave stale access.
 */
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '../../../shared/subscriptionPlans.js';
import type { BillingStatus } from './types.js';

export type EntitlementSource = 'free' | 'stripe' | 'complimentary' | 'admin';

export interface EffectiveEntitlement {
  plan: SubscriptionPlanId;
  source: EntitlementSource;
  maxActiveGoals: number;
  hasAdvertising: boolean;
  /** ISO timestamp. Present for a grace period or a time-limited complimentary grant. */
  expiresAt?: string;
}

export interface BillingState {
  status: BillingStatus;
  plan: SubscriptionPlanId | null;
  /** ISO timestamp: paid access should be honored through this date regardless of current status. */
  paidThroughDate?: string;
  /** Set once a past_due status is first observed following a prior successful payment. */
  gracePeriodEndsAt?: string;
}

export interface ComplimentaryGrant {
  plan: SubscriptionPlanId;
  /** undefined means a reviewed permanent grant, never an accidental unlimited default. */
  expiresAt?: string;
}

function freeEntitlement(): EffectiveEntitlement {
  const free = SUBSCRIPTION_PLANS.free;
  return {
    plan: 'free',
    source: 'free',
    maxActiveGoals: free.maxActiveGoals,
    hasAdvertising: free.hasAdvertising,
  };
}

function planEntitlement(plan: SubscriptionPlanId, source: EntitlementSource, expiresAt?: string): EffectiveEntitlement {
  const def = SUBSCRIPTION_PLANS[plan];
  return {
    plan,
    source,
    maxActiveGoals: def.maxActiveGoals,
    hasAdvertising: def.hasAdvertising,
    ...(expiresAt ? { expiresAt } : {}),
  };
}

/**
 * Computes effective access for one user from every possible source, in
 * priority order: trusted admin > valid complimentary grant > verified
 * billing state > Free default. `now` is injectable for deterministic tests.
 */
export function computeEffectiveEntitlement(input: {
  isTrustedAdmin: boolean;
  complimentaryGrant?: ComplimentaryGrant | null;
  billing?: BillingState | null;
  now?: Date;
}): EffectiveEntitlement {
  const now = input.now ?? new Date();

  if (input.isTrustedAdmin) {
    return {
      plan: 'enterprise',
      source: 'admin',
      maxActiveGoals: -1,
      hasAdvertising: false,
    };
  }

  const grant = input.complimentaryGrant;
  if (grant) {
    const expired = grant.expiresAt !== undefined && new Date(grant.expiresAt) <= now;
    if (!expired) {
      return planEntitlement(grant.plan, 'complimentary', grant.expiresAt);
    }
    // Expired grant: fall through to billing/free, same as any other lapsed access.
  }

  const billing = input.billing;
  if (billing?.plan) {
    switch (billing.status) {
      case 'active':
      case 'trialing':
        // A first release has no trial benefit yet (section 5): trialing
        // still requires an explicit later trial feature to grant paid
        // access. Until then, fall through to Free for 'trialing'.
        if (billing.status === 'trialing') break;
        return planEntitlement(billing.plan, 'stripe');

      case 'past_due': {
        // Cancellation scheduled for period end, or still within the paid-through
        // window: keep paid access. Otherwise honor the grace period if one was set.
        if (billing.paidThroughDate && new Date(billing.paidThroughDate) > now) {
          return planEntitlement(billing.plan, 'stripe', billing.paidThroughDate);
        }
        if (billing.gracePeriodEndsAt && new Date(billing.gracePeriodEndsAt) > now) {
          return planEntitlement(billing.plan, 'stripe', billing.gracePeriodEndsAt);
        }
        break;
      }

      case 'canceled':
      case 'incomplete':
      case 'incomplete_expired':
      case 'unpaid':
      case 'paused':
      default:
        // Cancellation scheduled for period end: keep paid access through
        // paidThroughDate even though status has moved to 'canceled'.
        if (billing.paidThroughDate && new Date(billing.paidThroughDate) > now) {
          return planEntitlement(billing.plan, 'stripe', billing.paidThroughDate);
        }
        break;
    }
  }

  return freeEntitlement();
}

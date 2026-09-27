/**
 * Server-owned Firestore record shapes (admin_subscriptions.md section 5).
 * Mirrors the client-facing types in src/types.ts, but this is the
 * authoritative backend definition — the frontend types describe what the
 * client is allowed to read, not what the backend is allowed to write.
 */
import type { SubscriptionPlanId } from '../../../shared/subscriptionPlans.js';

export type BillingStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'grace_period'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused'
  | 'canceled';

export interface BillingCustomerRecord {
  uid: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  priceId?: string;
  plan: SubscriptionPlanId | null;
  interval: 'month' | 'year' | null;
  status: BillingStatus;
  paidThroughDate?: string;
  gracePeriodEndsAt?: string;
  cancelAtPeriodEnd: boolean;
  lastSyncedAt: string;
}

/**
 * billingSummaries/{uid} — owner-readable projection of BillingCustomerRecord
 * with no Stripe customer/subscription/price IDs. Written alongside
 * BillingCustomerRecord in syncSubscription.ts; never written from a client.
 */
export interface BillingSummaryRecord {
  uid: string;
  status: BillingStatus;
  plan: SubscriptionPlanId | null;
  interval: 'month' | 'year' | null;
  paidThroughDate?: string;
  gracePeriodEndsAt?: string;
  cancelAtPeriodEnd: boolean;
}

export interface EntitlementRecord {
  uid: string;
  plan: SubscriptionPlanId;
  source: 'free' | 'stripe' | 'complimentary' | 'admin';
  maxActiveGoals: number;
  hasAdvertising: boolean;
  expiresAt?: string;
  updatedAt: string;
}

export interface UsageRecord {
  uid: string;
  activeGoalCount: number;
  updatedAt: string;
}

export interface ComplimentaryGrantRecord {
  uid: string;
  plan: SubscriptionPlanId;
  expiresAt?: string;
  grantedBy: string;
  reason: string;
  createdAt: string;
}

export interface StripeEventRecord {
  eventId: string;
  type: string;
  processedAt: string;
  status: 'processed' | 'failed' | 'retrying';
}

export interface AdminAuditLogRecord {
  id: string;
  actorUid: string;
  targetUid: string;
  action: string;
  reason: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

import { SUBSCRIPTION_PLANS as SHARED_SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '../shared/subscriptionPlans.js';

export type UserRole = 'user' | 'admin';

/** @deprecated Use SubscriptionPlanId from shared/subscriptionPlans.ts. Kept as an alias during migration. */
export type SubscriptionPlan = SubscriptionPlanId;

export interface SubscriptionLimits {
  maxGoals: number;
  features: string[];
  price: number; // Monthly price in USD
}

/**
 * @deprecated Derived from the shared catalog for backward compatibility with
 * existing UI code during migration. New code should read
 * shared/subscriptionPlans.ts directly, or better, the user's server-owned
 * entitlement (see EffectiveEntitlement below) rather than their raw
 * subscriptionPlan field.
 */
export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionLimits> = Object.fromEntries(
  Object.values(SHARED_SUBSCRIPTION_PLANS).map((plan) => [
    plan.id,
    {
      maxGoals: plan.maxActiveGoals,
      features: plan.features,
      price: plan.monthlyPrice ?? -1,
    },
  ])
) as Record<SubscriptionPlan, SubscriptionLimits>;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  subscriptionPlan: SubscriptionPlan;
  createdAt: string;
  lastLoginAt: string;
  isActive: boolean;
}

// --- Entitlement, billing, usage, and audit types (admin_subscriptions.md section 5/6) ---
// These describe server-owned records. The client only ever reads them;
// writes happen exclusively through backend functions (functions/src/billing,
// functions/src/admin). See firestore.rules for the matching read/write guards.

/** Where a user's current effective access is coming from. */
export type EntitlementSource = 'free' | 'stripe' | 'complimentary' | 'admin';

/**
 * entitlements/{uid} — server-owned effective plan, computed by the backend
 * from billing state, complimentary grants, and admin claims. Never
 * client-writable. See functions/src/lib/entitlements.ts once implemented.
 */
export interface Entitlement {
  uid: string;
  plan: SubscriptionPlanId;
  source: EntitlementSource;
  maxActiveGoals: number;
  hasAdvertising: boolean;
  /** ISO timestamp. Present for complimentary grants and grace periods; absent for indefinite access. */
  expiresAt?: string;
  updatedAt: string;
}

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

/**
 * billingCustomers/{uid} — server-owned Stripe customer/subscription
 * mapping. The owner may read a summary view of this (see BillingSummary);
 * only the backend ever writes it.
 */
export interface BillingCustomer {
  uid: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  priceId?: string;
  status: BillingStatus;
  /** ISO timestamp: access is paid-through this date even if status has since changed. */
  paidThroughDate?: string;
  cancelAtPeriodEnd: boolean;
  lastSyncedAt: string;
}

/** Owner-readable projection of BillingCustomer with no internal Stripe IDs. */
export interface BillingSummary {
  gracePeriodEndsAt?: string;
  status: BillingStatus;
  paidThroughDate?: string;
  cancelAtPeriodEnd: boolean;
  plan: SubscriptionPlanId | null;
  interval: 'month' | 'year' | null;
}

/**
 * usage/{uid} — server-maintained active-goal counter, updated atomically
 * with goal mutations (see functions/src/goals/mutateGoals.ts, step 4).
 */
export interface UsageRecord {
  uid: string;
  activeGoalCount: number;
  updatedAt: string;
}

/** stripeEvents/{eventId} — backend-only webhook processing/dedup records. */
export interface StripeEventRecord {
  eventId: string;
  type: string;
  processedAt: string;
  status: 'processed' | 'failed' | 'retrying';
}

/** adminAuditLogs/{id} — backend-only append log of privileged admin actions. */
export interface AdminAuditLogEntry {
  id: string;
  actorUid: string;
  targetUid: string;
  action: string;
  reason: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  targetHours: number;
  currentLevel: number;
  startDate: string;
  totalTimeSpent: number;
  weeklyTimeSpent: number;
  weeklyGoal: number;
  medals: string[];
  trophies: number;
  practiceDays: string[];
  settings: GoalSettings;
  note?: string;
  completed?: boolean;
  completedDate?: string;
  lastTimerStartedAt?: number;
  weeklyTrophies: WeeklyTrophy[];
  progressPeriods?: Record<string, { hours: number; earned: boolean }>;
  activityDays?: Record<string, { hours: number; trophies: number }>;
}

export interface WeeklyTrophy {
  weekNumber: number;
  year: number;
  trophies: number;
  weeklyTimeSpent: number;
}

export interface Timer {
  isRunning: boolean;
  startTime: number | null;
  elapsedTime: number;
}

export interface GoalSettings {
  frequency: 'daily' | 'weekly' | 'monthly';
  target: {
    type: 'hours' | 'days' | 'weeks' | 'months' | 'books' | 'tutorials' | 'videos';
    value: number;
  };
  resources: Resource[];
  reminders: boolean;
  notifications: boolean;
  reminderTime?: string;
}

export interface Resource {
  type: 'book' | 'tutorial' | 'video' | 'course' | 'project';
  name: string;
  url?: string;
  completed: boolean;
}

export const LEVELS = [
  { name: 'Beginner', months: '1-2', hours: '4-5', requiredHours: 4 },
  { name: 'Intermediate', months: '3-5', hours: '5-6', requiredHours: 20 },
  { name: 'Advanced', months: '6-8', hours: '6-7', requiredHours: 50 },
  { name: 'Master', months: '9-10', hours: '7-8', requiredHours: 100 },
  { name: 'Ninja', months: '11-12', hours: '8-10', requiredHours: 200 },
  { name: 'The One', months: '13-14', hours: '8-10', requiredHours: 350 },
  { name: 'God', months: '15-18', hours: '8-10', requiredHours: 500 }
];

export const DEFAULT_GOAL_SETTINGS: GoalSettings = {
  frequency: 'weekly',
  target: {
    type: 'hours',
    value: 5
  },
  resources: [],
  reminders: false,
  notifications: false,
};

export interface Campaign {
  id: string;
  name: string;
  type: 'internal' | 'external';
  url: string;
  description: string;
  status: 'active' | 'paused';
  clicks: number;
  revenue: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdvertisingWay {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  displayMethod: string;
  targetLocation: string;
  frequency: string;
  createdAt: string;
  updatedAt: string;
}

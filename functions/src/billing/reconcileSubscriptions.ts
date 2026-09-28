/**
 * Repair missed webhook updates and expire grace periods/complimentary
 * grants (admin_subscriptions.md section 5/6, step 6).
 *
 * Two entry points:
 * - reconcileAllSubscriptions: scheduled (see index.ts), walks every
 *   billingCustomers record with an active Stripe subscription and
 *   re-fetches+re-applies current Stripe state, so a dropped webhook
 *   eventually self-heals even with no further events.
 * - reconcileOneCustomer: a targeted repair callable for support use on a
 *   single UID/customer (admin_subscriptions.md section 9: "a targeted
 *   repair command for one UID/customer").
 *
 * Both also expire grace periods and complimentary grants whose date has
 * passed, even when no billing event ever arrives to trigger that check —
 * required because computeEffectiveEntitlement only re-evaluates when
 * something calls it, and nothing calls it on a timer otherwise.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { db, auth, requireAdmin } from '../lib/firebaseAdmin.js';
import { syncSubscriptionState } from './syncSubscription.js';
import { computeEffectiveEntitlement } from '../lib/entitlements.js';
import type { BillingCustomerRecord, EntitlementRecord, ComplimentaryGrantRecord } from '../lib/types.js';

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' });
}

interface ReconcileResult {
  uid: string;
  outcome: 'resynced' | 'expired-grace' | 'expired-grant' | 'no-change' | 'error';
  detail?: string;
}

/** Re-fetches and re-applies one customer's current Stripe subscription state. */
async function reconcileBillingRecord(stripe: Stripe, record: BillingCustomerRecord): Promise<ReconcileResult> {
  if (!record.stripeSubscriptionId) {
    return { uid: record.uid, outcome: 'no-change', detail: 'No subscription on record.' };
  }
  try {
    const subscription = await stripe.subscriptions.retrieve(record.stripeSubscriptionId, { expand: ['latest_invoice'] });
    await syncSubscriptionState(subscription);
    return { uid: record.uid, outcome: 'resynced' };
  } catch (err) {
    return { uid: record.uid, outcome: 'error', detail: (err as Error).message };
  }
}

/**
 * Expires a stale grace period on a billingCustomers record whose
 * gracePeriodEndsAt has already passed and re-derives the entitlement — this
 * runs even without a fresh Stripe fetch, since reconciliation must expire
 * grace periods "even if no subsequent webhook arrives" (section 6).
 */
async function expireStaleGracePeriod(record: BillingCustomerRecord): Promise<ReconcileResult | null> {
  if (!record.gracePeriodEndsAt || new Date(record.gracePeriodEndsAt) > new Date()) return null;
  if (record.paidThroughDate && new Date(record.paidThroughDate) > new Date()) return null; // still covered by paid-through date

  const complimentarySnap = await db.collection('complimentaryGrants').doc(record.uid).get();
  const complimentary = complimentarySnap.data() as ComplimentaryGrantRecord | undefined;

  const entitlement = computeEffectiveEntitlement({
    isTrustedAdmin: (await auth.getUser(record.uid).catch(() => null))?.customClaims?.admin === true,
    complimentaryGrant: complimentary ? { plan: complimentary.plan, expiresAt: complimentary.expiresAt } : null,
    billing: { status: record.status, plan: record.plan, paidThroughDate: record.paidThroughDate, gracePeriodEndsAt: undefined },
  });

  const entitlementRecord: EntitlementRecord = {
    uid: record.uid,
    plan: entitlement.plan,
    source: entitlement.source,
    maxActiveGoals: entitlement.maxActiveGoals,
    hasAdvertising: entitlement.hasAdvertising,
    ...(entitlement.expiresAt ? { expiresAt: entitlement.expiresAt } : {}),
    updatedAt: new Date().toISOString(),
  };

  await db.runTransaction(async (tx) => {
    // Preserve the expired deadline: clearing it would start a fresh grace
    // period when the next past_due webhook/reconciliation arrives.
    tx.set(db.collection('entitlements').doc(record.uid), entitlementRecord);
  });

  return { uid: record.uid, outcome: 'expired-grace' };
}

/** Expires a complimentary grant whose expiresAt has passed and re-derives the entitlement. */
async function expireStaleComplimentaryGrant(grant: ComplimentaryGrantRecord): Promise<ReconcileResult | null> {
  if (!grant.expiresAt || new Date(grant.expiresAt) > new Date()) return null;

  const billingSnap = await db.collection('billingCustomers').doc(grant.uid).get();
  const billing = billingSnap.data() as BillingCustomerRecord | undefined;

  const entitlement = computeEffectiveEntitlement({
    isTrustedAdmin: (await auth.getUser(grant.uid).catch(() => null))?.customClaims?.admin === true,
    complimentaryGrant: null, // this grant is now expired
    billing: billing ? { status: billing.status, plan: billing.plan, paidThroughDate: billing.paidThroughDate, gracePeriodEndsAt: billing.gracePeriodEndsAt } : null,
  });

  const entitlementRecord: EntitlementRecord = {
    uid: grant.uid,
    plan: entitlement.plan,
    source: entitlement.source,
    maxActiveGoals: entitlement.maxActiveGoals,
    hasAdvertising: entitlement.hasAdvertising,
    ...(entitlement.expiresAt ? { expiresAt: entitlement.expiresAt } : {}),
    updatedAt: new Date().toISOString(),
  };

  await db.collection('entitlements').doc(grant.uid).set(entitlementRecord);
  return { uid: grant.uid, outcome: 'expired-grant' };
}

export async function runReconciliation(): Promise<ReconcileResult[]> {
  const stripe = getStripe();
  const results: ReconcileResult[] = [];

  const billingSnap = await db.collection('billingCustomers').get();
  for (const doc of billingSnap.docs) {
    const record = doc.data() as BillingCustomerRecord;

    const graceResult = await expireStaleGracePeriod(record);
    if (graceResult) {
      results.push(graceResult);
      // Still fetch Stripe: a missed recovery event must restore paid access.
    }

    if (record.status === 'active' || record.status === 'past_due') {
      results.push(await reconcileBillingRecord(stripe, record));
    }
  }

  const grantsSnap = await db.collection('complimentaryGrants').get();
  for (const doc of grantsSnap.docs) {
    const grant = doc.data() as ComplimentaryGrantRecord;
    const grantResult = await expireStaleComplimentaryGrant(grant);
    if (grantResult) results.push(grantResult);
  }

  return results;
}

/** Scheduled reconciliation. Runs hourly; see admin_subscriptions.md section 6. */
export const reconcileSubscriptionsScheduled = onSchedule(
  { schedule: 'every 60 minutes', secrets: ['STRIPE_SECRET_KEY'] },
  async () => {
  const results = await runReconciliation();
  const errors = results.filter((r) => r.outcome === 'error');
  if (errors.length > 0) {
    console.error(`Reconciliation completed with ${errors.length} error(s):`, JSON.stringify(errors));
  } else {
    console.log(`Reconciliation completed: ${results.length} record(s) processed.`);
  }
  }
);

/** Targeted repair for one UID, for support use (section 9). Requires a trusted admin caller. */
export const reconcileOneCustomer = onCall({ secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
  requireAdmin(request);
  const targetUid = request.data?.uid as string | undefined;
  if (!targetUid) throw new HttpsError('invalid-argument', 'uid is required.');

  const billingSnap = await db.collection('billingCustomers').doc(targetUid).get();
  if (!billingSnap.exists) {
    throw new HttpsError('not-found', 'No billing record found for this user.');
  }

  const record = billingSnap.data() as BillingCustomerRecord;
  const stripe = getStripe();
  const result = await reconcileBillingRecord(stripe, record);
  return result;
});

/**
 * Idempotent subscription-to-entitlement projection (admin_subscriptions.md
 * section 5/6, step 6).
 *
 * Given a Stripe Subscription object (from a verified webhook event or a
 * reconciliation fetch — never from client input), this derives the app's
 * BillingCustomerRecord and effective Entitlement and writes both in one
 * transaction, using a monotonically increasing Stripe event/object version
 * to reject stale writes from out-of-order delivery.
 */
import type Stripe from 'stripe';
import { db, auth } from '../lib/firebaseAdmin.js';
import { computeEffectiveEntitlement, type BillingState } from '../lib/entitlements.js';
import { planFromPriceId } from '../lib/stripe.js';
import type { BillingCustomerRecord, BillingStatus, BillingSummaryRecord, EntitlementRecord, ComplimentaryGrantRecord } from '../lib/types.js';
import type { SubscriptionPlanId, BillingInterval } from '../../../shared/subscriptionPlans.js';

const GRACE_PERIOD_DAYS = 7;

function mapStripeStatus(status: Stripe.Subscription.Status): BillingStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'incomplete_expired';
    case 'unpaid':
      return 'unpaid';
    case 'paused':
      return 'paused';
    default:
      return 'incomplete';
  }
}

/**
 * Finds the Firebase UID for a Stripe subscription. Requires the
 * subscription (or its Customer) to carry `metadata.firebaseUid`, set when
 * the Customer was created in createCheckoutSession (step 7). Returns null
 * if unmapped so callers can log/alert instead of silently dropping the event.
 */
export async function resolveUidForSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const direct = subscription.metadata?.firebaseUid;
  if (direct) return direct;

  // Fall back to a reverse lookup by stored customer ID, in case metadata
  // was not propagated (e.g. an older Customer created before this field existed).
  const snap = await db.collection('billingCustomers').where('stripeCustomerId', '==', subscription.customer as string).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;

  return null;
}

/**
 * Applies one Stripe Subscription's current state to the corresponding
 * user's billing + entitlement records. Idempotent: reapplying the same
 * subscription state is a no-op beyond updating `lastSyncedAt`. Guards
 * against out-of-order delivery by comparing Stripe's `latest_invoice`/
 * object timestamps is intentionally NOT attempted here — Stripe recommends
 * simply re-fetching and applying current state, which this does by always
 * taking the subscription object as truth rather than diffing event history.
 */
export async function syncSubscriptionState(subscription: Stripe.Subscription): Promise<{ uid: string } | { skipped: string }> {
  const uid = await resolveUidForSubscription(subscription);
  if (!uid) {
    return { skipped: `No Firebase UID mapped for subscription ${subscription.id} (customer ${subscription.customer}).` };
  }

  // As of the Basil API version (2025-03-31 and later), the billing period
  // lives on each subscription item rather than on the Subscription object
  // itself — a subscription can in principle have items on different cycles,
  // but this app only ever creates single-item subscriptions, so item[0] is
  // authoritative for both the price and the period end.
  const primaryItem = subscription.items.data[0];
  const priceId = primaryItem?.price?.id;
  const mapped = priceId ? planFromPriceId(priceId) : null;

  // A trusted admin's entitlement is sourced from their custom claim
  // (admin_subscriptions.md section 5: "Trusted admin claim -> Unlimited,
  // ad-free, no subscription required"), which takes priority over any
  // billing state. Check it here so a webhook event for an admin's own test
  // purchase never downgrades their access.
  let isTrustedAdmin = false;
  try {
    const userRecord = await auth.getUser(uid);
    isTrustedAdmin = userRecord.customClaims?.admin === true;
  } catch {
    // Unknown/deleted Firebase user — proceed as non-admin; the entitlement
    // write below still lands, and a deleted-account edge case is handled
    // by the account-deletion billing workflow (section 5, step 9), not here.
  }

  const billingCustomerRef = db.collection('billingCustomers').doc(uid);
  const billingSummaryRef = db.collection('billingSummaries').doc(uid);
  const entitlementRef = db.collection('entitlements').doc(uid);
  const complimentaryRef = db.collection('complimentaryGrants').doc(uid);

  await db.runTransaction(async (tx) => {
    const [existingBillingSnap, complimentarySnap] = await Promise.all([tx.get(billingCustomerRef), tx.get(complimentaryRef)]);
    const existingBilling = existingBillingSnap.data() as BillingCustomerRecord | undefined;

    // Reject a stale event: if we already recorded this exact subscription
    // at a status/period combination that is at least as current, skip.
    // Stripe subscriptions carry no simple monotonic version counter, so we
    // approximate using current_period_end + status, which only moves
    // forward for the same subscription under normal lifecycle progression.
    const newPeriodEnd = primaryItem.current_period_end;
    const isSameOrOlder =
      existingBilling?.stripeSubscriptionId === subscription.id &&
      existingBilling.status === mapStripeStatus(subscription.status) &&
      existingBilling.paidThroughDate !== undefined &&
      new Date(existingBilling.paidThroughDate).getTime() >= newPeriodEnd * 1000;

    const status = mapStripeStatus(subscription.status);
    const plan: SubscriptionPlanId | null = mapped?.plan ?? existingBilling?.plan ?? null;
    const interval: BillingInterval | null = mapped?.interval ?? existingBilling?.interval ?? null;
    const paidThroughDate = new Date(newPeriodEnd * 1000).toISOString();

    // An initial failed payment never earns the renewal grace period —
    // only set gracePeriodEndsAt when the subscription had previously
    // reached 'active' (i.e. at least one successful payment happened).
    const hadPriorSuccess = existingBilling?.status === 'active' || existingBilling?.status === 'past_due';
    let gracePeriodEndsAt = existingBilling?.gracePeriodEndsAt;
    if (status === 'past_due' && hadPriorSuccess && !gracePeriodEndsAt) {
      gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    } else if (status !== 'past_due') {
      gracePeriodEndsAt = undefined;
    }

    if (isSameOrOlder) {
      tx.set(billingCustomerRef, { lastSyncedAt: new Date().toISOString() }, { merge: true });
      return;
    }

    const billingRecord: BillingCustomerRecord = {
      uid,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      priceId,
      plan,
      interval,
      status,
      paidThroughDate,
      ...(gracePeriodEndsAt ? { gracePeriodEndsAt } : {}),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      lastSyncedAt: new Date().toISOString(),
    };
    tx.set(billingCustomerRef, billingRecord);

    // Owner-readable projection with no internal Stripe IDs — Firestore
    // reads return whole documents, so this MUST be a separate document from
    // billingCustomers rather than a rules field filter (admin_subscriptions.md
    // section 6: "store backend-only details in a separate document instead
    // of relying on field-level read filtering").
    const summaryRecord: BillingSummaryRecord = {
      uid,
      status,
      plan,
      interval,
      paidThroughDate,
      ...(gracePeriodEndsAt ? { gracePeriodEndsAt } : {}),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
    tx.set(billingSummaryRef, summaryRecord);

    const complimentary = complimentarySnap.data() as ComplimentaryGrantRecord | undefined;
    const billingState: BillingState = {
      status,
      plan,
      paidThroughDate,
      gracePeriodEndsAt,
    };
    const entitlement = computeEffectiveEntitlement({
      isTrustedAdmin,
      complimentaryGrant: complimentary ? { plan: complimentary.plan, expiresAt: complimentary.expiresAt } : null,
      billing: billingState,
    });

    const entitlementRecord: EntitlementRecord = {
      uid,
      plan: entitlement.plan,
      source: entitlement.source,
      maxActiveGoals: entitlement.maxActiveGoals,
      hasAdvertising: entitlement.hasAdvertising,
      ...(entitlement.expiresAt ? { expiresAt: entitlement.expiresAt } : {}),
      updatedAt: new Date().toISOString(),
    };
    tx.set(entitlementRef, entitlementRecord);
  });

  return { uid };
}

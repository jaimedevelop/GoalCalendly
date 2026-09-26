/**
 * Authenticated subscription Checkout creation (admin_subscriptions.md
 * section 5/6, step 7).
 *
 * The signed-in client sends only `plan` and `interval`; the server resolves
 * the actual Price ID, creates/reuses the Stripe Customer, and returns a
 * hosted Checkout URL. Never trust a client-supplied Price ID, customer ID,
 * or return URL.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { requireAuth, db } from '../lib/firebaseAdmin.js';
import { resolvePriceId } from '../lib/stripe.js';
import type { BillingCustomerRecord } from '../lib/types.js';
import type { BillingInterval } from '../../../shared/subscriptionPlans.js';

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
}

function isCheckoutEnabled(): boolean {
  // Server-owned switch (admin_subscriptions.md section 6): turning it off
  // stops new purchases while webhooks, reconciliation, and Manage billing
  // keep working. Defaults to disabled so a missing env var fails closed.
  return process.env.CHECKOUT_ENABLED === 'true';
}

/**
 * Finds or creates the Stripe Customer for this Firebase user, storing the
 * mapping so future calls (and webhook events, via the fallback lookup in
 * syncSubscription.ts) can resolve it. Uses a per-user reservation inside a
 * transaction so two concurrent Checkout requests from the same user cannot
 * create two different Stripe Customers.
 */
async function ensureStripeCustomer(stripe: Stripe, uid: string, email: string | undefined): Promise<string> {
  const ref = db.collection('billingCustomers').doc(uid);

  const existingCustomerId = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.data() as BillingCustomerRecord | undefined;
    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    // Reserve the slot before the (slower, external) Stripe API call so a
    // concurrent request sees this write and doesn't also try to create one.
    // The actual customer ID is filled in right after, still inside the same
    // logical operation from the caller's perspective.
    tx.set(ref, { uid, status: 'none', cancelAtPeriodEnd: false, lastSyncedAt: new Date().toISOString() }, { merge: true });
    return null;
  });

  if (existingCustomerId) return existingCustomerId;

  const customer = await stripe.customers.create({
    email,
    metadata: { firebaseUid: uid },
  });

  await ref.set({ uid, stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
}

export const createCheckoutSession = onCall(async (request) => {
  const uid = requireAuth(request);
  const email = request.auth?.token.email;

  if (!isCheckoutEnabled()) {
    throw new HttpsError('failed-precondition', 'New subscriptions are temporarily unavailable. Existing billing management remains available.');
  }

  const { plan, interval, requestId } = (request.data ?? {}) as { plan?: string; interval?: string; requestId?: string };

  if (plan !== 'pro' && plan !== 'platinum') {
    throw new HttpsError('invalid-argument', 'plan must be "pro" or "platinum".');
  }
  if (interval !== 'month' && interval !== 'year') {
    throw new HttpsError('invalid-argument', 'interval must be "month" or "year".');
  }
  if (!requestId) {
    throw new HttpsError('invalid-argument', 'requestId is required.');
  }

  const appOrigin = process.env.APP_ORIGIN;
  if (!appOrigin) throw new Error('APP_ORIGIN is not configured.');

  const stripe = getStripe();

  // Reuse an unexpired pending session for this exact request instead of
  // creating a duplicate — protects against a double-click or a retried call.
  const pendingRef = db.collection('checkoutReservations').doc(`${uid}_${requestId}`);
  const pendingSnap = await pendingRef.get();
  if (pendingSnap.exists) {
    const pending = pendingSnap.data() as { sessionUrl: string; expiresAt: number };
    if (pending.expiresAt > Date.now()) {
      return { url: pending.sessionUrl };
    }
  }

  // An existing active/past_due subscriber should manage billing, not start
  // a second subscription (admin_subscriptions.md: "Do not create a second
  // subscription to switch tiers").
  const billingSnap = await db.collection('billingCustomers').doc(uid).get();
  const billing = billingSnap.data() as BillingCustomerRecord | undefined;
  if (billing?.status === 'active' || billing?.status === 'past_due' || billing?.status === 'trialing') {
    throw new HttpsError('already-exists', 'You already have an active subscription. Use Manage billing to change plans.');
  }

  const customerId = await ensureStripeCustomer(stripe, uid, email);
  const priceId = resolvePriceId(plan, interval as BillingInterval);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appOrigin}/billing/return?status=success`,
    cancel_url: `${appOrigin}/billing/return?status=cancelled`,
    subscription_data: {
      metadata: { firebaseUid: uid },
    },
    metadata: { firebaseUid: uid, requestId },
  });

  if (!session.url) throw new Error('Stripe did not return a Checkout URL.');

  await pendingRef.set({ sessionUrl: session.url, expiresAt: Date.now() + 30 * 60 * 1000 });

  return { url: session.url };
});

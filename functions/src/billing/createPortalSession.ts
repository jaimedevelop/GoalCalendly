/**
 * Authenticated access to the caller's own Stripe Customer Portal
 * (admin_subscriptions.md section 5/6, step 7).
 *
 * Uses only the authenticated user's own stored customer ID — never a
 * client-supplied one — so Manage billing can only ever open the correct
 * customer's portal.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { requireAuth, db } from '../lib/firebaseAdmin.js';
import type { BillingCustomerRecord } from '../lib/types.js';

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' });
}

export const createPortalSession = onCall({ secrets: ['STRIPE_SECRET_KEY'] }, async (request) => {
  const uid = requireAuth(request);

  const billingSnap = await db.collection('billingCustomers').doc(uid).get();
  const billing = billingSnap.data() as BillingCustomerRecord | undefined;

  if (!billing?.stripeCustomerId) {
    // Useful response rather than a generic error, per the plan's contract
    // table ("Manage billing ... useful response if no customer exists").
    // Checked before the environment/config checks below so a caller with no
    // billing account gets this actionable message even in a misconfigured
    // environment, rather than an opaque "internal" error.
    throw new HttpsError('failed-precondition', 'No billing account exists yet. Subscribe to a paid plan first.');
  }

  const appOrigin = process.env.APP_ORIGIN;
  if (!appOrigin) throw new Error('APP_ORIGIN is not configured.');

  const stripe = getStripe();
  const portalConfigurationId = process.env.STRIPE_PORTAL_CONFIGURATION_ID;

  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: `${appOrigin}/billing/return?status=portal-return`,
    ...(portalConfigurationId ? { configuration: portalConfigurationId } : {}),
  });

  return { url: session.url };
});

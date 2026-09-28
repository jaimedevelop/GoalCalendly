/**
 * Stripe webhook endpoint: raw-body signature verification, durable event
 * deduplication, and dispatch to syncSubscription (admin_subscriptions.md
 * section 5/6, step 6).
 *
 * This is an onRequest function (not onCall) because Stripe posts directly
 * to it with no Firebase ID token — authentication here IS the signature
 * check, which is why the raw body must reach Stripe's SDK unmodified.
 */
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { db } from '../lib/firebaseAdmin.js';
import { syncSubscriptionState } from './syncSubscription.js';
import type { StripeEventRecord } from '../lib/types.js';

const HANDLED_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
]);

/**
 * Processes one verified Stripe event. Exported separately from the HTTP
 * handler so reconciliation and tests can drive it directly without going
 * through signature verification.
 */
export async function handleStripeEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  const eventRef = db.collection('stripeEvents').doc(event.id);

  // Durable dedup: claim this event ID before doing any work. A retried
  // delivery of an event we already finished is a safe no-op; a retry of one
  // that's still 'retrying' (a previous attempt crashed mid-processing) is
  // allowed to proceed again.
  const claimed = await db.runTransaction(async (tx) => {
    const existing = await tx.get(eventRef);
    if (existing.exists && (existing.data() as StripeEventRecord).status === 'processed') {
      return false;
    }
    const record: StripeEventRecord = { eventId: event.id, type: event.type, processedAt: new Date().toISOString(), status: 'retrying' };
    tx.set(eventRef, record);
    return true;
  });

  if (!claimed) return; // already processed; nothing to do

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    await eventRef.set({ status: 'processed', processedAt: new Date().toISOString() }, { merge: true });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string, { expand: ['latest_invoice'] });
          await syncSubscriptionState(subscription, event.created);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        if (typeof subscription.latest_invoice === 'string') {
          subscription.latest_invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
        }
        await syncSubscriptionState(subscription, event.created);
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.payment_action_required': {
        const invoice = event.data.object as Stripe.Invoice;
        // Since the Basil API version (2025-03-31+), an invoice's subscription
        // link moved off the top-level `subscription` field onto
        // `parent.subscription_details.subscription`.
        const subscriptionId = invoice.parent?.subscription_details?.subscription;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId as string, { expand: ['latest_invoice'] });
          await syncSubscriptionState(subscription, event.created);
        }
        break;
      }
    }

    await eventRef.set({ status: 'processed', processedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    // Leave status as 'retrying' so Stripe's automatic retry (or a manual
    // replay) can complete processing; log without leaking secrets.
    console.error(`Failed to process Stripe event ${event.id} (${event.type}):`, (err as Error).message);
    throw err;
  }
}

export const stripeWebhook = onRequest(
  { cors: false, secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
  async (req, res) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey || !webhookSecret) {
      // Refuse to process anything until the signing secret is configured —
      // never accept unverified events (credentials.md step 6 / section 5).
      res.status(503).send('Webhook not configured.');
      return;
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2026-08-26.dahlia' });
    const signature = req.headers['stripe-signature'];

    let event: Stripe.Event;
    try {
      // req.rawBody is populated by the Firebase Functions HTTP runtime
      // specifically so signature verification can use the exact bytes
      // Stripe signed, before any JSON body-parsing middleware touches it.
      event = stripe.webhooks.constructEvent(req.rawBody, signature as string, webhookSecret);
    } catch (err) {
      console.error('Stripe signature verification failed:', (err as Error).message);
      res.status(400).send('Invalid signature.');
      return;
    }

    try {
      await handleStripeEvent(stripe, event);
      res.status(200).send('ok');
    } catch {
      // Durable processing failed; return 5xx so Stripe retries. The event
      // marker stays 'retrying', so the retry (or reconciliation) can finish it.
      res.status(500).send('Processing failed, will retry.');
    }
  }
);

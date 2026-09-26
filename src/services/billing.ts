/**
 * Callable Checkout/Portal client (functions/src/billing/createCheckoutSession.ts,
 * createPortalSession.ts). admin_subscriptions.md section 5/6, step 7.
 *
 * The client only ever sends the chosen plan/interval — the server resolves
 * the actual Stripe Price ID, customer, and return URLs. This module never
 * needs a Stripe publishable key: the app redirects to a server-created
 * hosted Checkout/Portal URL rather than using the Stripe.js browser SDK.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase.js';
import type { BillingInterval } from '../../shared/subscriptionPlans.js';

export interface BillingActionError {
  code: string;
  message: string;
}

export interface BillingActionResult {
  ok: boolean;
  url?: string;
  error?: BillingActionError;
}

const createCheckoutSessionCallable = httpsCallable(functions, 'createCheckoutSession');
const createPortalSessionCallable = httpsCallable(functions, 'createPortalSession');

function newRequestId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function toResult(err: unknown): BillingActionResult {
  const firebaseError = err as { code?: string; message?: string };
  return {
    ok: false,
    error: {
      code: firebaseError.code ?? 'unknown',
      message: firebaseError.message ?? 'The server could not start this billing action.',
    },
  };
}

/**
 * Starts a subscription Checkout for the given plan/interval. On success,
 * the caller should redirect the browser to `result.url`; this function does
 * not navigate itself, so callers can show a pending state first if desired.
 */
export async function startCheckout(plan: 'pro' | 'platinum', interval: BillingInterval): Promise<BillingActionResult> {
  try {
    const response = await createCheckoutSessionCallable({ plan, interval, requestId: newRequestId() });
    const data = response.data as { url: string };
    return { ok: true, url: data.url };
  } catch (err) {
    return toResult(err);
  }
}

/** Opens the caller's own Stripe Customer Portal for billing management. */
export async function openBillingPortal(): Promise<BillingActionResult> {
  try {
    const response = await createPortalSessionCallable({});
    const data = response.data as { url: string };
    return { ok: true, url: data.url };
  } catch (err) {
    return toResult(err);
  }
}

/**
 * Client for admin-only account/access-management callables
 * (functions/src/admin/manageAccess.ts, manageAccountLifecycle.ts).
 * admin_subscriptions.md section 9, step 9.
 *
 * Replaces the old direct Firestore writes to `role`/`subscriptionPlan`/
 * `isActive` (src/services/user.ts's updateUserSubscription/updateUserRole/
 * toggleUserStatus/deleteUser) — those are now denied by firestore.rules and
 * would fail if called. Every privileged action here is audited server-side.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase.js';
import type { Entitlement, BillingSummary } from '../types.js';
import type { SubscriptionPlanId } from '../../shared/subscriptionPlans.js';

export interface AdminActionError {
  code: string;
  message: string;
}

export interface AdminActionResult {
  ok: boolean;
  error?: AdminActionError;
}

export interface ComplimentaryGrantSummary {
  plan: SubscriptionPlanId;
  expiresAt?: string;
  grantedBy: string;
  reason: string;
  createdAt: string;
}

export interface UserAccessSummary {
  uid: string;
  entitlement: Entitlement | null;
  billing: BillingSummary | null;
  complimentaryGrant: ComplimentaryGrantSummary | null;
}

const listUserAccessSummariesCallable = httpsCallable(functions, 'listUserAccessSummaries');
const grantComplimentaryAccessCallable = httpsCallable(functions, 'grantComplimentaryAccess');
const revokeComplimentaryAccessCallable = httpsCallable(functions, 'revokeComplimentaryAccess');
const checkAccountBillingStatusCallable = httpsCallable(functions, 'checkAccountBillingStatus');
const deactivateAccountCallable = httpsCallable(functions, 'deactivateAccount');
const reactivateAccountCallable = httpsCallable(functions, 'reactivateAccount');
const deleteAccountCallable = httpsCallable(functions, 'deleteAccount');

function toResult(err: unknown): AdminActionResult {
  const firebaseError = err as { code?: string; message?: string };
  const code = firebaseError.code ?? 'unknown';
  // See src/services/goals.ts: "functions/internal" carries the literal message
  // "internal" for a transport-level failure, not a real server message.
  const isTransportFailure = code === 'functions/internal' || code === 'functions/unavailable';
  return {
    ok: false,
    error: {
      code,
      message: isTransportFailure
        ? "You're offline. This action couldn't be completed — check your connection and try again."
        : firebaseError.message ?? 'The action failed.',
    },
  };
}

/** Effective plan/billing/grant state for every user — admin dashboard only. */
export async function listUserAccessSummaries(): Promise<{ ok: true; summaries: UserAccessSummary[] } | { ok: false; error: AdminActionError }> {
  try {
    const response = await listUserAccessSummariesCallable({});
    const data = response.data as { summaries: UserAccessSummary[] };
    return { ok: true, summaries: data.summaries };
  } catch (err) {
    return { ok: false, error: toResult(err).error! };
  }
}

export async function grantComplimentaryAccess(
  targetUid: string,
  plan: SubscriptionPlanId,
  expiresAt: string | undefined,
  reason: string
): Promise<AdminActionResult> {
  try {
    await grantComplimentaryAccessCallable({ targetUid, plan, expiresAt, reason });
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function revokeComplimentaryAccess(targetUid: string, reason: string): Promise<AdminActionResult> {
  try {
    await revokeComplimentaryAccessCallable({ targetUid, reason });
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export interface BillingStatusCheck {
  hasLiveSubscription: boolean;
  status: string;
  cancelAtPeriodEnd: boolean;
  paidThroughDate: string | null;
}

export async function checkAccountBillingStatus(targetUid: string): Promise<{ ok: true; status: BillingStatusCheck } | { ok: false; error: AdminActionError }> {
  try {
    const response = await checkAccountBillingStatusCallable({ uid: targetUid });
    return { ok: true, status: response.data as BillingStatusCheck };
  } catch (err) {
    return { ok: false, error: toResult(err).error! };
  }
}

export async function deactivateAccount(targetUid: string, reason: string): Promise<AdminActionResult> {
  try {
    await deactivateAccountCallable({ targetUid, reason });
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function reactivateAccount(targetUid: string, reason: string): Promise<AdminActionResult> {
  try {
    await reactivateAccountCallable({ targetUid, reason });
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function deleteAccount(targetUid: string, reason: string, acknowledgeLiveSubscription = false): Promise<AdminActionResult> {
  try {
    await deleteAccountCallable({ targetUid, reason, acknowledgeLiveSubscription });
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

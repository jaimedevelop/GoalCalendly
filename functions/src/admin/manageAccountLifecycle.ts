/**
 * Audited account deactivation/deletion with explicit billing handling
 * (admin_subscriptions.md section 5/9: "Handle subscriptions explicitly
 * before account deletion so a deleted profile cannot leave a hidden
 * recurring charge").
 *
 * Both actions are admin-only and require the caller to have already
 * confirmed the billing situation via `checkAccountBillingStatus` — deletion
 * is refused outright if the target has an active/past_due/trialing
 * subscription, so an admin cannot accidentally orphan a live Stripe
 * subscription by deleting the Firestore profile out from under it.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { requireAdmin, auth, db } from '../lib/firebaseAdmin.js';
import type { AdminAuditLogRecord, BillingSummaryRecord } from '../lib/types.js';

/** Read-only check an admin should call before attempting deletion. */
export const checkAccountBillingStatus = onCall(async (request) => {
  requireAdmin(request);
  const targetUid = request.data?.uid as string | undefined;
  if (!targetUid) throw new HttpsError('invalid-argument', 'uid is required.');

  const billingSnap = await db.collection('billingSummaries').doc(targetUid).get();
  const billing = billingSnap.data() as BillingSummaryRecord | undefined;

  const hasLiveSubscription = billing?.status === 'active' || billing?.status === 'past_due' || billing?.status === 'trialing';

  return {
    hasLiveSubscription,
    status: billing?.status ?? 'none',
    cancelAtPeriodEnd: billing?.cancelAtPeriodEnd ?? false,
    paidThroughDate: billing?.paidThroughDate ?? null,
  };
});

/**
 * Deactivates a user account (isActive: false). Does not delete data or
 * touch billing — a deactivated user's existing subscription keeps running
 * until explicitly cancelled through the normal billing flow, so
 * deactivation alone never silently stops or starts a charge.
 */
export const deactivateAccount = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const { targetUid, reason } = request.data ?? {};
  if (!targetUid || !reason) throw new HttpsError('invalid-argument', 'targetUid and reason are required.');

  const userRef = db.collection('users').doc(targetUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'No user profile found for that UID.');

  const wasActive = userSnap.data()?.isActive;
  await userRef.update({ isActive: false, lastLoginAt: userSnap.data()?.lastLoginAt ?? new Date().toISOString() });

  const auditEntry: AdminAuditLogRecord = {
    id: `${Date.now()}-${targetUid}`,
    actorUid,
    targetUid,
    action: 'deactivate_account',
    reason,
    before: { isActive: wasActive },
    after: { isActive: false },
    createdAt: new Date().toISOString(),
  };
  await db.collection('adminAuditLogs').doc(auditEntry.id).set(auditEntry);

  return { ok: true };
});

/** Reactivates a previously deactivated account. */
export const reactivateAccount = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const { targetUid, reason } = request.data ?? {};
  if (!targetUid || !reason) throw new HttpsError('invalid-argument', 'targetUid and reason are required.');

  const userRef = db.collection('users').doc(targetUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'No user profile found for that UID.');

  await userRef.update({ isActive: true });

  const auditEntry: AdminAuditLogRecord = {
    id: `${Date.now()}-${targetUid}`,
    actorUid,
    targetUid,
    action: 'reactivate_account',
    reason,
    before: { isActive: false },
    after: { isActive: true },
    createdAt: new Date().toISOString(),
  };
  await db.collection('adminAuditLogs').doc(auditEntry.id).set(auditEntry);

  return { ok: true };
});

/**
 * Deletes a user's profile, goals, and related records — but refuses
 * outright if the target has a live (active/past_due/trialing) Stripe
 * subscription, unless the caller explicitly confirms they understand the
 * subscription must be cancelled separately (never auto-cancelled here,
 * since that's a real financial action that deserves its own deliberate
 * step through the normal billing/support flow, not a side effect of
 * deleting a profile).
 */
export const deleteAccount = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const { targetUid, reason, acknowledgeLiveSubscription } = request.data ?? {};
  if (!targetUid || !reason) throw new HttpsError('invalid-argument', 'targetUid and reason are required.');

  const billingSnap = await db.collection('billingSummaries').doc(targetUid).get();
  const billing = billingSnap.data() as BillingSummaryRecord | undefined;
  const hasLiveSubscription = billing?.status === 'active' || billing?.status === 'past_due' || billing?.status === 'trialing';

  if (hasLiveSubscription && !acknowledgeLiveSubscription) {
    throw new HttpsError(
      'failed-precondition',
      `This account has a live subscription (status: ${billing?.status}). Cancel it through Stripe/the billing support workflow first, or pass acknowledgeLiveSubscription to confirm you understand deleting this profile will NOT cancel the Stripe subscription.`
    );
  }

  const userRef = db.collection('users').doc(targetUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'No user profile found for that UID.');
  const beforeProfile = userSnap.data();

  // Delete the user's goals and profile. Billing/entitlement/audit records
  // are intentionally preserved — they are the durable record required by
  // section 5 ("preserve Stripe customer/subscription mappings, events,
  // audit records" — the same principle applies to a deleted account, so
  // support can still investigate/reconcile a since-deleted user's history).
  const goalsSnap = await db.collection('goals').where('userId', '==', targetUid).get();
  const batch = db.batch();
  for (const doc of goalsSnap.docs) batch.delete(doc.ref);
  batch.delete(userRef);

  const auditEntry: AdminAuditLogRecord = {
    id: `${Date.now()}-${targetUid}`,
    actorUid,
    targetUid,
    action: 'delete_account',
    reason,
    before: { profile: beforeProfile, hadLiveSubscription: hasLiveSubscription, billingStatus: billing?.status ?? 'none' },
    createdAt: new Date().toISOString(),
  };
  batch.set(db.collection('adminAuditLogs').doc(auditEntry.id), auditEntry);

  await batch.commit();

  try {
    await auth.deleteUser(targetUid);
  } catch (err) {
    // Firestore data is already gone; surface this so the admin knows the
    // Auth record needs manual cleanup rather than silently leaving it.
    throw new HttpsError('internal', `Profile deleted, but removing the Firebase Auth user failed: ${(err as Error).message}`);
  }

  return { ok: true, hadLiveSubscription: hasLiveSubscription };
});

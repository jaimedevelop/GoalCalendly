/**
 * Server-authorized profile creation, allowlisted profile updates, and
 * audited complimentary-access grants (admin_subscriptions.md section 3/9).
 *
 * Direct client writes to `role`, `subscriptionPlan`, and the entitlement/
 * billing collections are denied in firestore.rules; everything privileged
 * goes through these callables instead.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { requireAuth, requireAdmin, auth, db } from '../lib/firebaseAdmin.js';
import { computeEffectiveEntitlement } from '../lib/entitlements.js';
import type { EntitlementRecord, ComplimentaryGrantRecord, AdminAuditLogRecord, BillingSummaryRecord } from '../lib/types.js';

const ALLOWLISTED_PROFILE_FIELDS = new Set(['displayName']);

/**
 * Creates a Free profile for the calling user if one does not already
 * exist. Role and subscriptionPlan are always forced to safe defaults —
 * the client cannot request a different starting role or plan.
 */
export const createFreeProfile = onCall(async (request) => {
  const uid = requireAuth(request);
  const email = request.auth?.token.email ?? null;
  if (!email) {
    throw new HttpsError('failed-precondition', 'An email address is required to create a profile.');
  }

  const ref = db.collection('users').doc(uid);
  const existing = await ref.get();
  if (existing.exists) {
    return { created: false };
  }

  const now = new Date().toISOString();
  await ref.set({
    uid,
    email,
    displayName: (request.data?.displayName as string | undefined) ?? null,
    role: 'user',
    subscriptionPlan: 'free',
    createdAt: now,
    lastLoginAt: now,
    isActive: true,
  });

  const entitlement = computeEffectiveEntitlement({ isTrustedAdmin: false });
  const entitlementRecord: EntitlementRecord = {
    uid,
    plan: entitlement.plan,
    source: entitlement.source,
    maxActiveGoals: entitlement.maxActiveGoals,
    hasAdvertising: entitlement.hasAdvertising,
    updatedAt: now,
  };
  await db.collection('entitlements').doc(uid).set(entitlementRecord);

  return { created: true };
});

/** Updates only allowlisted personal fields on the caller's own profile. */
export const updateOwnProfile = onCall(async (request) => {
  const uid = requireAuth(request);
  const updates = request.data ?? {};

  const safeUpdates: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    if (ALLOWLISTED_PROFILE_FIELDS.has(key)) {
      safeUpdates[key] = updates[key];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    throw new HttpsError('invalid-argument', 'No allowed fields to update.');
  }

  safeUpdates.lastLoginAt = new Date().toISOString();
  await db.collection('users').doc(uid).update(safeUpdates);
  return { ok: true };
});

/**
 * Authorized complimentary access grant (admin_subscriptions.md section 6).
 * Requires a trusted admin caller; writes an audit entry alongside the
 * grant and refreshes the target's entitlement.
 */
export const grantComplimentaryAccess = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const { targetUid, plan, expiresAt, reason } = request.data ?? {};

  if (!targetUid || !plan || !reason) {
    throw new HttpsError('invalid-argument', 'targetUid, plan, and reason are required.');
  }

  const now = new Date().toISOString();

  // A trusted admin's access is sourced from their custom claim, which
  // already outranks any grant (admin_subscriptions.md section 5). Recompute
  // with that in mind so granting a complimentary plan to an admin account
  // doesn't silently downgrade their entitlement's `source`/limits, and
  // fold in their current billing state so a paying subscriber's grant
  // reflects both records rather than discarding their billing context.
  let isTargetTrustedAdmin = false;
  try {
    const targetUser = await auth.getUser(targetUid);
    isTargetTrustedAdmin = targetUser.customClaims?.admin === true;
  } catch {
    throw new HttpsError('not-found', 'No Firebase user found for that UID.');
  }

  const grant: ComplimentaryGrantRecord = {
    uid: targetUid,
    plan,
    ...(expiresAt ? { expiresAt } : {}),
    grantedBy: actorUid,
    reason,
    createdAt: now,
  };

  const billingSnap = await db.collection('billingSummaries').doc(targetUid).get();
  const billingSummary = billingSnap.data() as BillingSummaryRecord | undefined;

  const entitlement = computeEffectiveEntitlement({
    isTrustedAdmin: isTargetTrustedAdmin,
    complimentaryGrant: { plan: grant.plan, expiresAt: grant.expiresAt },
    billing: billingSummary
      ? { status: billingSummary.status, plan: billingSummary.plan, paidThroughDate: billingSummary.paidThroughDate, gracePeriodEndsAt: billingSummary.gracePeriodEndsAt }
      : null,
  });

  const batch = db.batch();
  batch.set(db.collection('complimentaryGrants').doc(targetUid), grant);
  batch.set(db.collection('entitlements').doc(targetUid), {
    uid: targetUid,
    plan: entitlement.plan,
    source: entitlement.source,
    maxActiveGoals: entitlement.maxActiveGoals,
    hasAdvertising: entitlement.hasAdvertising,
    ...(entitlement.expiresAt ? { expiresAt: entitlement.expiresAt } : {}),
    updatedAt: now,
  } satisfies EntitlementRecord);

  const auditEntry: AdminAuditLogRecord = {
    id: `${Date.now()}-${targetUid}`,
    actorUid,
    targetUid,
    action: 'grant_complimentary_access',
    reason,
    after: grant,
    createdAt: now,
  };
  batch.set(db.collection('adminAuditLogs').doc(auditEntry.id), auditEntry);

  await batch.commit();
  return { ok: true };
});

/**
 * Revokes an existing complimentary grant, restoring the target's
 * entitlement to whatever their billing state / admin status alone would
 * produce. Audited the same way as granting.
 */
export const revokeComplimentaryAccess = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const { targetUid, reason } = request.data ?? {};

  if (!targetUid || !reason) {
    throw new HttpsError('invalid-argument', 'targetUid and reason are required.');
  }

  const now = new Date().toISOString();
  const grantSnap = await db.collection('complimentaryGrants').doc(targetUid).get();
  if (!grantSnap.exists) {
    throw new HttpsError('not-found', 'No complimentary grant exists for this user.');
  }
  const previousGrant = grantSnap.data() as ComplimentaryGrantRecord;

  let isTargetTrustedAdmin = false;
  try {
    const targetUser = await auth.getUser(targetUid);
    isTargetTrustedAdmin = targetUser.customClaims?.admin === true;
  } catch {
    // Proceed — a deleted user's entitlement doc no longer matters, but the
    // grant should still be removed and the action still audited.
  }

  const billingSnap = await db.collection('billingSummaries').doc(targetUid).get();
  const billingSummary = billingSnap.data() as BillingSummaryRecord | undefined;

  const entitlement = computeEffectiveEntitlement({
    isTrustedAdmin: isTargetTrustedAdmin,
    complimentaryGrant: null,
    billing: billingSummary
      ? { status: billingSummary.status, plan: billingSummary.plan, paidThroughDate: billingSummary.paidThroughDate, gracePeriodEndsAt: billingSummary.gracePeriodEndsAt }
      : null,
  });

  const batch = db.batch();
  batch.delete(db.collection('complimentaryGrants').doc(targetUid));
  batch.set(db.collection('entitlements').doc(targetUid), {
    uid: targetUid,
    plan: entitlement.plan,
    source: entitlement.source,
    maxActiveGoals: entitlement.maxActiveGoals,
    hasAdvertising: entitlement.hasAdvertising,
    ...(entitlement.expiresAt ? { expiresAt: entitlement.expiresAt } : {}),
    updatedAt: now,
  } satisfies EntitlementRecord);

  const auditEntry: AdminAuditLogRecord = {
    id: `${Date.now()}-${targetUid}`,
    actorUid,
    targetUid,
    action: 'revoke_complimentary_access',
    reason,
    before: previousGrant,
    createdAt: now,
  };
  batch.set(db.collection('adminAuditLogs').doc(auditEntry.id), auditEntry);

  await batch.commit();
  return { ok: true };
});

/**
 * Lists every user's effective plan/source/billing summary in one call, for
 * the admin dashboard — the client cannot query other users' entitlement or
 * billing documents directly (firestore.rules only allows owner reads), so
 * this Admin-SDK-backed callable is the only way the dashboard can show
 * billed-vs-effective plan without granting broad Firestore read access.
 */
export const listUserAccessSummaries = onCall(async (request) => {
  requireAdmin(request);

  const [usersSnap, entitlementsSnap, billingSnap, grantsSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('entitlements').get(),
    db.collection('billingSummaries').get(),
    db.collection('complimentaryGrants').get(),
  ]);

  const entitlementsByUid = new Map(entitlementsSnap.docs.map((d) => [d.id, d.data() as EntitlementRecord]));
  const billingByUid = new Map(billingSnap.docs.map((d) => [d.id, d.data() as BillingSummaryRecord]));
  const grantsByUid = new Map(grantsSnap.docs.map((d) => [d.id, d.data() as ComplimentaryGrantRecord]));

  return {
    summaries: usersSnap.docs.map((doc) => {
      const uid = doc.id;
      return {
        uid,
        entitlement: entitlementsByUid.get(uid) ?? null,
        billing: billingByUid.get(uid) ?? null,
        complimentaryGrant: grantsByUid.get(uid) ?? null,
      };
    }),
  };
});

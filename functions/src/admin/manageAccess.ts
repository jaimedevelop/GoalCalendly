/**
 * Server-authorized profile creation, allowlisted profile updates, and
 * audited complimentary-access grants (admin_subscriptions.md section 3/9).
 *
 * Direct client writes to `role`, `subscriptionPlan`, and the entitlement/
 * billing collections are denied in firestore.rules; everything privileged
 * goes through these callables instead.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { requireAuth, requireAdmin, db } from '../lib/firebaseAdmin.js';
import { computeEffectiveEntitlement } from '../lib/entitlements.js';
import type { EntitlementRecord, ComplimentaryGrantRecord, AdminAuditLogRecord } from '../lib/types.js';

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
  const grant: ComplimentaryGrantRecord = {
    uid: targetUid,
    plan,
    ...(expiresAt ? { expiresAt } : {}),
    grantedBy: actorUid,
    reason,
    createdAt: now,
  };

  const entitlement = computeEffectiveEntitlement({
    isTrustedAdmin: false,
    complimentaryGrant: { plan: grant.plan, expiresAt: grant.expiresAt },
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

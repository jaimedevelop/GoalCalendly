/**
 * Server-owned maintenance-window switches (admin_subscriptions.md section 9:
 * "deny client goal writes and pause backend goal mutations" during a counter
 * migration). Admin-only, audited, instant (a Firestore flag `mutateGoals`
 * checks directly — no redeploy needed to pause or resume).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { requireAdmin, db } from '../lib/firebaseAdmin.js';
import type { AdminAuditLogRecord } from '../lib/types.js';

export const setGoalWritesPaused = onCall(async (request) => {
  const actorUid = requireAdmin(request);
  const { paused, reason } = request.data ?? {};
  if (typeof paused !== 'boolean' || !reason) {
    throw new HttpsError('invalid-argument', 'paused (boolean) and reason are required.');
  }

  const flagRef = db.collection('systemFlags').doc('goalWritesPaused');
  const before = (await flagRef.get()).data()?.paused ?? false;

  await flagRef.set({
    paused,
    reason,
    updatedBy: actorUid,
    updatedAt: new Date().toISOString(),
  });

  const auditEntry: AdminAuditLogRecord = {
    id: `${Date.now()}-goalWritesPaused`,
    actorUid,
    targetUid: 'system',
    action: paused ? 'pause_goal_writes' : 'resume_goal_writes',
    reason,
    before: { paused: before },
    after: { paused },
    createdAt: new Date().toISOString(),
  };
  await db.collection('adminAuditLogs').doc(auditEntry.id).set(auditEntry);

  return { ok: true, paused };
});

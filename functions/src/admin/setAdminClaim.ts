/**
 * Trusted admin claim provisioning (admin_subscriptions.md section 2/3).
 *
 * This replaces automatic admin assignment from a hard-coded email
 * (`admin@admin.com`) with an explicit, backend-only action. It is not a
 * callable function — see functions/scripts/setAdminClaim.ts for the CLI
 * entry point a developer runs locally with an authorized identity, per
 * credentials.md step 3 (no service-account key needed; Firebase CLI login
 * is sufficient for local Admin SDK calls against a project you can access).
 */
import { auth, db } from '../lib/firebaseAdmin.js';
import type { AdminAuditLogRecord } from '../lib/types.js';

export async function setAdminClaim(uid: string, isAdmin: boolean, actorUid: string, reason: string): Promise<void> {
  const user = await auth.getUser(uid);
  const before = user.customClaims ?? {};

  await auth.setCustomUserClaims(uid, { ...before, admin: isAdmin });

  const entry: AdminAuditLogRecord = {
    id: `${Date.now()}-${uid}`,
    actorUid,
    targetUid: uid,
    action: isAdmin ? 'grant_admin' : 'revoke_admin',
    reason,
    before: { admin: before.admin ?? false },
    after: { admin: isAdmin },
    createdAt: new Date().toISOString(),
  };
  await db.collection('adminAuditLogs').doc(entry.id).set(entry);
}

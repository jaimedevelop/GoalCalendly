#!/usr/bin/env node
/**
 * CLI: explicit trusted admin provisioning.
 *
 * Usage (run from functions/, after `npm run build`, against the intended
 * project — never guess which project is active):
 *   node --experimental-strip-types scripts/setAdminClaim.ts <uid> grant "reason"
 *   node --experimental-strip-types scripts/setAdminClaim.ts <uid> revoke "reason"
 *
 * Requires Application Default Credentials for the target project (e.g. via
 * `gcloud auth application-default login` or GOOGLE_APPLICATION_CREDENTIALS),
 * or run inside `firebase functions:shell` against the emulator. See
 * credentials.md step 3: a downloaded service-account key is NOT required
 * for normal use.
 *
 * The actor UID recorded in the audit log is read from ADMIN_ACTION_ACTOR_UID
 * so the log always names a real operator, never an assumed "system" value.
 */
import { setAdminClaim } from '../src/admin/setAdminClaim.js';

const [, , uid, action, reason] = process.argv;

if (!uid || !action || (action !== 'grant' && action !== 'revoke') || !reason) {
  console.error('Usage: setAdminClaim.ts <uid> <grant|revoke> "<reason>"');
  process.exit(1);
}

const actorUid = process.env.ADMIN_ACTION_ACTOR_UID;
if (!actorUid) {
  console.error('Set ADMIN_ACTION_ACTOR_UID to the operator\'s own Firebase UID before running this script.');
  process.exit(1);
}

setAdminClaim(uid, action === 'grant', actorUid, reason)
  .then(() => {
    console.log(`${action === 'grant' ? 'Granted' : 'Revoked'} admin claim for ${uid}.`);
  })
  .catch((err) => {
    console.error('Failed to set admin claim:', err);
    process.exit(1);
  });

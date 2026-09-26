/**
 * Callable function exports.
 *
 * Billing (createCheckoutSession, createPortalSession, stripeWebhook, ...)
 * and goal-mutation functions are added in later roadmap steps (5-7, 4).
 */
import { onCall } from 'firebase-functions/v2/https';
import { requireAuth } from './lib/firebaseAdmin.js';

export { createFreeProfile, updateOwnProfile, grantComplimentaryAccess } from './admin/manageAccess.js';
export { mutateGoals } from './goals/mutateGoals.js';

/**
 * Protected test endpoint for Step 2's completion check: an unauthenticated
 * call must be rejected. Safe to remove once real callable functions exist
 * and cover the same authentication path.
 */
export const ping = onCall((request) => {
  const uid = requireAuth(request);
  return { ok: true, uid };
});

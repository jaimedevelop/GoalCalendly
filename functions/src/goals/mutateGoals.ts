/**
 * Transactional server goal commands (admin_subscriptions.md section 4/6).
 *
 * Every mutation that can increase the caller's active-goal count — create,
 * import, shared-goal import, duplication, and reopening a completed goal —
 * goes through validateAndApplyGoalMutation, which atomically re-reads the
 * caller's current usage counter and effective entitlement in the same
 * transaction before writing, so two concurrent requests (two devices, or a
 * replayed request) cannot together exceed the limit.
 *
 * Edits, completion, and deletion never increase the active count, so they
 * are allowed even when the caller is currently over their limit (the
 * non-destructive over-limit policy from section 2).
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth, db } from '../lib/firebaseAdmin.js';
import { isGoalActive, isUnderActiveGoalLimit } from '../../../shared/subscriptionPlans.js';
import type { SubscriptionPlanId } from '../../../shared/subscriptionPlans.js';
import type { EntitlementRecord } from '../lib/types.js';

export type GoalMutationType =
  | 'create'
  | 'import'
  | 'sharedImport'
  | 'duplicate'
  | 'reopen'
  | 'update'
  | 'complete'
  | 'delete';

interface GoalMutationRequest {
  requestId: string;
  type: GoalMutationType;
  /** For create/import/duplicate/reopen: the goal document(s) to write. */
  goals?: Record<string, unknown>[];
  /** For update/complete/delete: the target goal ID. */
  goalId?: string;
  /** For update/complete: partial fields to merge. */
  updates?: Record<string, unknown>;
}

const INCREASES_ACTIVE_COUNT: ReadonlySet<GoalMutationType> = new Set([
  'create',
  'import',
  'sharedImport',
  'duplicate',
  'reopen',
]);

function defaultEntitlement(): { plan: SubscriptionPlanId } {
  return { plan: 'free' };
}

/**
 * Idempotent, transactional goal mutation. Concurrent calls with the same
 * requestId (e.g. an offline replay, or a double-click) are deduplicated via
 * a per-user, per-request marker document so a retried request cannot double
 * count against the quota or double-apply a write.
 */
export const mutateGoals = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data as GoalMutationRequest;

  if (!data?.requestId || !data?.type) {
    throw new HttpsError('invalid-argument', 'requestId and type are required.');
  }

  // Maintenance-window switch: during a counter migration (section 9's
  // production cutover, step 3), the operator pauses all goal writes via a
  // Firestore flag (instant, no redeploy) while migration runs, then resumes
  // once verified. Fails closed on a read error, same as the entitlement
  // fallback below never grants extra access on a transient failure.
  const pauseSnap = await db.collection('systemFlags').doc('goalWritesPaused').get();
  if (pauseSnap.exists && pauseSnap.data()?.paused === true) {
    throw new HttpsError('unavailable', 'Goal writes are temporarily paused for maintenance. Please try again shortly.');
  }

  const requestMarkerRef = db.collection('goalMutationRequests').doc(`${uid}_${data.requestId}`);
  const usageRef = db.collection('usage').doc(uid);
  const entitlementRef = db.collection('entitlements').doc(uid);
  const goalsRef = db.collection('goals');

  return db.runTransaction(async (tx) => {
    const [markerSnap, usageSnap, entitlementSnap] = await Promise.all([
      tx.get(requestMarkerRef),
      tx.get(usageRef),
      tx.get(entitlementRef),
    ]);

    // Idempotent replay: a previously-completed request with this ID returns
    // its recorded result again instead of re-applying (and re-counting) it.
    if (markerSnap.exists) {
      return markerSnap.data()?.result ?? { ok: true, replay: true };
    }

    const entitlement = (entitlementSnap.data() as EntitlementRecord | undefined) ?? {
      ...defaultEntitlement(),
      maxActiveGoals: 2,
    };
    const currentActiveCount = (usageSnap.data()?.activeGoalCount as number | undefined) ?? 0;

    const willIncreaseCount = INCREASES_ACTIVE_COUNT.has(data.type);
    const incomingCount = data.goals?.length ?? 1;

    if (willIncreaseCount) {
      // Validate the WHOLE batch against the limit atomically — two
      // concurrent devices each importing goals cannot together exceed it,
      // because both transactions read the same usage doc and Firestore
      // serializes the retry of whichever one commits second.
      for (let i = 1; i <= incomingCount; i++) {
        if (!isUnderActiveGoalLimit(entitlement.plan, currentActiveCount + i - 1)) {
          throw new HttpsError(
            'resource-exhausted',
            `Active goal limit reached (${entitlement.maxActiveGoals ?? 'plan limit'}). Upgrade your plan or complete an existing goal to add more.`
          );
        }
      }
    }

    let activeCountDelta = 0;

    switch (data.type) {
      case 'create':
      case 'duplicate':
      case 'import':
      case 'sharedImport': {
        for (const goal of data.goals ?? []) {
          if (typeof goal.id !== 'string') {
            throw new HttpsError('invalid-argument', 'Each goal requires an id.');
          }
          tx.set(goalsRef.doc(goal.id), { ...goal, userId: uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          if (isGoalActive(goal as { completed?: boolean })) activeCountDelta += 1;
        }
        break;
      }

      case 'reopen': {
        if (!data.goalId) throw new HttpsError('invalid-argument', 'goalId is required to reopen a goal.');
        const goalSnap = await tx.get(goalsRef.doc(data.goalId));
        if (!goalSnap.exists || goalSnap.data()?.userId !== uid) {
          throw new HttpsError('not-found', 'Goal not found.');
        }
        tx.update(goalsRef.doc(data.goalId), {
          completed: false,
          completedDate: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        activeCountDelta = 1;
        break;
      }

      case 'update': {
        if (!data.goalId) throw new HttpsError('invalid-argument', 'goalId is required.');
        const goalSnap = await tx.get(goalsRef.doc(data.goalId));
        if (!goalSnap.exists || goalSnap.data()?.userId !== uid) {
          throw new HttpsError('not-found', 'Goal not found.');
        }
        tx.update(goalsRef.doc(data.goalId), { ...(data.updates ?? {}), updatedAt: FieldValue.serverTimestamp() });
        break;
      }

      case 'complete': {
        if (!data.goalId) throw new HttpsError('invalid-argument', 'goalId is required.');
        const goalSnap = await tx.get(goalsRef.doc(data.goalId));
        if (!goalSnap.exists || goalSnap.data()?.userId !== uid) {
          throw new HttpsError('not-found', 'Goal not found.');
        }
        const wasActive = isGoalActive(goalSnap.data() as { completed?: boolean });
        tx.update(goalsRef.doc(data.goalId), {
          completed: true,
          completedDate: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (wasActive) activeCountDelta = -1;
        break;
      }

      case 'delete': {
        if (!data.goalId) throw new HttpsError('invalid-argument', 'goalId is required.');
        const goalSnap = await tx.get(goalsRef.doc(data.goalId));
        if (!goalSnap.exists || goalSnap.data()?.userId !== uid) {
          throw new HttpsError('not-found', 'Goal not found.');
        }
        const wasActive = isGoalActive(goalSnap.data() as { completed?: boolean });
        tx.delete(goalsRef.doc(data.goalId));
        if (wasActive) activeCountDelta = -1;
        break;
      }

      default:
        throw new HttpsError('invalid-argument', `Unknown mutation type: ${data.type}`);
    }

    if (activeCountDelta !== 0) {
      tx.set(
        usageRef,
        { uid, activeGoalCount: Math.max(0, currentActiveCount + activeCountDelta), updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }

    const result = { ok: true };
    tx.set(requestMarkerRef, { result, createdAt: FieldValue.serverTimestamp() });
    return result;
  });
});

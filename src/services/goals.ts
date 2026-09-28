/**
 * Client for the server-authoritative goal mutation command
 * (functions/src/goals/mutateGoals.ts). Every write to a goal document goes
 * through here — direct Firestore writes to `goals/*` are denied by
 * firestore.rules (admin_subscriptions.md section 4/6).
 *
 * Each call carries a stable requestId so a retried/duplicated submission
 * (double-click, offline replay) is deduplicated server-side rather than
 * double-counting against the active-goal limit.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase.js';
import { Goal } from '../types.js';

export type GoalMutationType =
  | 'create'
  | 'import'
  | 'sharedImport'
  | 'duplicate'
  | 'reopen'
  | 'update'
  | 'complete'
  | 'delete';

export interface GoalMutationError {
  code: string;
  message: string;
}

export interface GoalMutationResult {
  ok: boolean;
  error?: GoalMutationError;
}

const mutateGoalsCallable = httpsCallable(functions, 'mutateGoals');

function newRequestId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

async function callMutateGoals(payload: {
  type: GoalMutationType;
  goals?: Goal[];
  goalId?: string;
  updates?: Partial<Goal>;
  requestId?: string;
}): Promise<GoalMutationResult> {
  const requestId = payload.requestId ?? newRequestId();
  try {
    await mutateGoalsCallable({ ...payload, requestId });
    return { ok: true };
  } catch (err: unknown) {
    const firebaseError = err as { code?: string; message?: string };
    const code = firebaseError.code ?? 'unknown';
    // The Functions SDK throws code "functions/internal" with message literally
    // "internal" for transport-level failures (e.g. the client is offline and the
    // call never reached the server) — that raw string isn't a real server message
    // and must not be shown to the user as if it were one.
    const isTransportFailure = code === 'functions/internal' || code === 'functions/unavailable';
    return {
      ok: false,
      error: {
        code,
        message: isTransportFailure
          ? "You're offline. This change couldn't be saved — check your connection and try again."
          : firebaseError.message ?? 'The server rejected this change.',
      },
    };
  }
}

export const createGoal = (goal: Goal) => callMutateGoals({ type: 'create', goals: [goal] });

export const importGoals = (goals: Goal[]) => callMutateGoals({ type: 'import', goals });

export const importSharedGoals = (goals: Goal[]) => callMutateGoals({ type: 'sharedImport', goals });

export const duplicateGoal = (goal: Goal) => callMutateGoals({ type: 'duplicate', goals: [goal] });

export const reopenGoal = (goalId: string) => callMutateGoals({ type: 'reopen', goalId });

// Keep typing autosaves and an explicit Save in order for the same goal.
// Otherwise a slower earlier request can overwrite a newer edit.
const updateQueues = new Map<string, Promise<GoalMutationResult>>();
export function updateGoalFields(goalId: string, updates: Partial<Goal>): Promise<GoalMutationResult> {
  const previous = updateQueues.get(goalId) ?? Promise.resolve({ ok: true });
  const next = previous.then(() => callMutateGoals({ type: 'update', goalId, updates }));
  updateQueues.set(goalId, next);
  void next.then(() => { if (updateQueues.get(goalId) === next) updateQueues.delete(goalId); });
  return next;
}

/** Explicit backup save of existing goals through the protected update API.
 * Completion/reopening and creation retain their own quota-checked commands.
 */
export async function saveGoalSnapshots(goals: Goal[]): Promise<GoalMutationResult> {
  const snapshots: Goal[] = JSON.parse(JSON.stringify(goals));
  const results = await Promise.all(snapshots.map(goal => {
    const updates: Partial<Goal> = { ...goal };
    delete updates.id;
    delete updates.completed;
    delete updates.completedDate;
    // Enqueue every snapshot now, before any edits made after clicking Save.
    return updateGoalFields(goal.id, updates);
  }));
  return results.find(result => !result.ok) ?? { ok: true };
}

export const completeGoal = (goalId: string) => callMutateGoals({ type: 'complete', goalId });

export const deleteGoalRemote = (goalId: string) => callMutateGoals({ type: 'delete', goalId });

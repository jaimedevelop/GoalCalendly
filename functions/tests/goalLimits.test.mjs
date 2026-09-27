/**
 * mutateGoals integration tests (admin_subscriptions.md section 10, step 4).
 *
 * Exercises the deployed transaction against the real Functions + Firestore
 * emulators (not the pure unit-tested policy logic in shared/subscriptionPlans.ts) —
 * proving: concurrent creation cannot exceed the limit, a duplicate/replayed
 * request does not double-count, an import batch that would exceed the limit
 * is rejected atomically, and a legacy Free user already over the new limit
 * can still edit/complete/delete but not add more.
 *
 * Requires the Functions + Firestore emulators running:
 *   npm run emulators  (or --only functions,firestore,auth)
 *
 * Run with: node --test functions/tests/goalLimits.test.mjs
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import {
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import fs from 'node:fs';

const PROJECT_ID = 'demo-goalcalendly';

let testEnv;
let mutateGoals;
let currentUid;

function newGoal(overrides = {}) {
  return {
    id: `goal_${Math.random().toString(36).slice(2)}`,
    name: 'Test goal',
    targetHours: 4,
    currentLevel: 1,
    startDate: new Date().toISOString(),
    totalTimeSpent: 0,
    weeklyTimeSpent: 0,
    weeklyGoal: 4,
    medals: [],
    trophies: 0,
    practiceDays: [],
    weeklyTrophies: [],
    settings: { frequency: 'weekly', target: { type: 'hours', value: 4 }, resources: [], reminders: false, notifications: false },
    ...overrides,
  };
}

async function setUsage(uid, activeGoalCount) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('usage').doc(uid).set({ uid, activeGoalCount, updatedAt: new Date().toISOString() });
  });
}

async function setEntitlement(uid, plan, maxActiveGoals) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('entitlements').doc(uid).set({ uid, plan, source: 'free', maxActiveGoals, hasAdvertising: true, updatedAt: new Date().toISOString() });
  });
}

async function seedGoal(uid, goal) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('goals').doc(goal.id).set({ ...goal, userId: uid });
  });
}

async function getUsage(uid) {
  // withSecurityRulesDisabled discards its callback's return value, so the
  // read result must be captured into an outer variable instead of returned.
  let activeGoalCount = 0;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await ctx.firestore().collection('usage').doc(uid).get();
    activeGoalCount = snap.exists ? snap.data()?.activeGoalCount ?? 0 : 0;
  });
  return activeGoalCount;
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake', authDomain: `${PROJECT_ID}.firebaseapp.com` });
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  mutateGoals = httpsCallable(functions, 'mutateGoals');

  const cred = await signInAnonymously(auth);
  currentUid = cred.user.uid;
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await setEntitlement(currentUid, 'free', 2);
  await setUsage(currentUid, 0);
});

after(async () => {
  await testEnv?.cleanup();
});

test('creating up to the limit succeeds, and the next create is rejected', async () => {
  await mutateGoals({ requestId: 'r1', type: 'create', goals: [newGoal()] });
  await mutateGoals({ requestId: 'r2', type: 'create', goals: [newGoal()] });
  assert.equal(await getUsage(currentUid), 2);

  await assert.rejects(
    () => mutateGoals({ requestId: 'r3', type: 'create', goals: [newGoal()] }),
    (err) => {
      assert.equal(err.code, 'functions/resource-exhausted');
      return true;
    }
  );
  assert.equal(await getUsage(currentUid), 2);
});

test('two concurrent creates from two devices cannot together exceed the limit', async () => {
  await setUsage(currentUid, 1); // one active goal already, limit is 2

  const results = await Promise.allSettled([
    mutateGoals({ requestId: 'concurrent-a', type: 'create', goals: [newGoal()] }),
    mutateGoals({ requestId: 'concurrent-b', type: 'create', goals: [newGoal()] }),
  ]);

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const rejected = results.filter((r) => r.status === 'rejected').length;

  assert.equal(succeeded, 1, 'exactly one of the two concurrent creates should succeed');
  assert.equal(rejected, 1);
  assert.equal(await getUsage(currentUid), 2, 'usage counter must land at exactly the limit, never over');
});

test('replaying the same requestId does not double-count', async () => {
  const goal = newGoal();
  await mutateGoals({ requestId: 'replay-1', type: 'create', goals: [goal] });
  assert.equal(await getUsage(currentUid), 1);

  // Same requestId again — simulates an offline retry or double-submit.
  await mutateGoals({ requestId: 'replay-1', type: 'create', goals: [goal] });
  assert.equal(await getUsage(currentUid), 1, 'a replayed request must not increment usage a second time');
});

test('an import batch that would exceed the limit is rejected atomically (no partial import)', async () => {
  await mutateGoals({ requestId: 'seed', type: 'create', goals: [newGoal()] }); // 1 active, limit 2

  await assert.rejects(() =>
    mutateGoals({ requestId: 'bulk-import', type: 'import', goals: [newGoal(), newGoal()] })
  );

  assert.equal(await getUsage(currentUid), 1, 'a rejected import must not partially apply');
});

test('a legacy Free user already over the new limit can edit, complete, and delete, but not add more', async () => {
  // Simulate 3 pre-existing active goals under the old Free=3 catalog, now over the new Free=2 limit.
  const legacyGoals = [newGoal(), newGoal(), newGoal()];
  for (const g of legacyGoals) await seedGoal(currentUid, g);
  await setUsage(currentUid, 3);

  // Cannot add a 4th.
  await assert.rejects(() => mutateGoals({ requestId: 'over-limit-create', type: 'create', goals: [newGoal()] }));

  // Can still edit an existing one.
  const editResult = await mutateGoals({
    requestId: 'over-limit-edit',
    type: 'update',
    goalId: legacyGoals[0].id,
    updates: { note: 'still editable while over limit' },
  });
  assert.equal(editResult.data.ok, true);

  // Can still complete one (this decreases usage, which is fine even over limit).
  const completeResult = await mutateGoals({ requestId: 'over-limit-complete', type: 'complete', goalId: legacyGoals[1].id });
  assert.equal(completeResult.data.ok, true);
  assert.equal(await getUsage(currentUid), 2);

  // Can still delete one.
  const deleteResult = await mutateGoals({ requestId: 'over-limit-delete', type: 'delete', goalId: legacyGoals[2].id });
  assert.equal(deleteResult.data.ok, true);
  assert.equal(await getUsage(currentUid), 1);
});

test('reopening a completed goal is validated against the limit like a create', async () => {
  const completed = newGoal({ completed: true, completedDate: new Date().toISOString() });
  await seedGoal(currentUid, completed);
  await setUsage(currentUid, 2); // already at the limit with OTHER active goals

  await assert.rejects(() => mutateGoals({ requestId: 'reopen-over-limit', type: 'reopen', goalId: completed.id }));
  assert.equal(await getUsage(currentUid), 2);

  await setUsage(currentUid, 1); // now under the limit
  const result = await mutateGoals({ requestId: 'reopen-ok', type: 'reopen', goalId: completed.id });
  assert.equal(result.data.ok, true);
  assert.equal(await getUsage(currentUid), 2);
});

test('an unauthenticated caller is rejected', async () => {
  // A fresh, signed-out functions client.
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake', authDomain: `${PROJECT_ID}.firebaseapp.com` }, 'unauth');
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const unauthCall = httpsCallable(functions, 'mutateGoals');

  await assert.rejects(
    () => unauthCall({ requestId: 'anon', type: 'create', goals: [newGoal()] }),
    (err) => {
      assert.equal(err.code, 'functions/unauthenticated');
      return true;
    }
  );
});

test('a maintenance-window pause blocks all goal writes, and resuming restores them', async () => {
  // Simulates the operator flipping systemFlags/goalWritesPaused during a
  // counter-migration maintenance window (admin_subscriptions.md section 9,
  // step 10's write-pause rehearsal), bypassing the admin callable to isolate
  // just mutateGoals's own check.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('systemFlags').doc('goalWritesPaused').set({
      paused: true,
      reason: 'test: rehearsing migration maintenance window',
      updatedBy: 'test-harness',
      updatedAt: new Date().toISOString(),
    });
  });

  await assert.rejects(
    () => mutateGoals({ requestId: 'paused-create', type: 'create', goals: [newGoal()] }),
    (err) => {
      assert.equal(err.code, 'functions/unavailable');
      return true;
    }
  );
  // Never-increasing mutations are blocked too — a real maintenance window
  // freezes ALL goal writes, not just quota-increasing ones.
  const existing = newGoal();
  await seedGoal(currentUid, existing);
  await assert.rejects(() => mutateGoals({ requestId: 'paused-delete', type: 'delete', goalId: existing.id }));
  assert.equal(await getUsage(currentUid), 0);

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('systemFlags').doc('goalWritesPaused').set({
      paused: false,
      reason: 'test: resuming after rehearsed migration window',
      updatedBy: 'test-harness',
      updatedAt: new Date().toISOString(),
    });
  });

  const result = await mutateGoals({ requestId: 'resumed-create', type: 'create', goals: [newGoal()] });
  assert.equal(result.data.ok, true);
  assert.equal(await getUsage(currentUid), 1);
});

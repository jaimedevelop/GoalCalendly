#!/usr/bin/env node
/**
 * Seeds synthetic legacy Free/paid profiles and goals into a real Firebase
 * project (intended for goal-calendly-staging only) to rehearse Step 10:
 * migration dry-run/apply/resume, the write-pause drill, and the section 5
 * concurrent-goal/security checks against deployed staging infrastructure.
 *
 * Refuses to run against goal-calendly (production) as a safety check.
 *
 * Usage (from functions/, after `npm run build`):
 *   tsx scripts/seedStagingFixtures.ts --env goal-calendly-staging
 *
 * Creates:
 * - legacyFree3Goals: Free-tier profile with 3 active goals (pre-dates the
 *   2-goal limit) and no usage/entitlement docs yet.
 * - legacyManualPro: profile with subscriptionPlan="pro" but no
 *   billingSummaries/complimentaryGrants record (i.e. an old manual grant
 *   that migration must convert to an audited complimentary grant, never
 *   trusted as real payment).
 * - freshFreeUser: plain Free signup, 1 active goal, already fully backfilled
 *   (usage + entitlement docs present) so migration should skip it entirely.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function parseArgs() {
  const idx = process.argv.indexOf('--env');
  const projectId = idx >= 0 ? process.argv[idx + 1] : undefined;
  if (!projectId) throw new Error('Pass --env <firebase-project-id> explicitly.');
  if (projectId === 'goal-calendly') {
    throw new Error('Refusing to seed synthetic fixtures into production (goal-calendly). Use goal-calendly-staging.');
  }
  return { projectId };
}

async function ensureUser(auth: ReturnType<typeof getAuth>, uid: string, email: string) {
  try {
    await auth.getUser(uid);
  } catch {
    await auth.createUser({ uid, email, emailVerified: true });
  }
}

async function main() {
  const { projectId } = parseArgs();
  if (getApps().length === 0) initializeApp({ projectId });
  const db = getFirestore();
  const auth = getAuth();

  const now = new Date().toISOString();

  // --- legacyFree3Goals ---
  const uid1 = 'seed_legacy_free_3goals';
  await ensureUser(auth, uid1, 'legacy-free-3goals@staging.test');
  await db.collection('users').doc(uid1).set({
    email: 'legacy-free-3goals@staging.test',
    subscriptionPlan: 'free',
    createdAt: now,
  });
  for (let i = 1; i <= 3; i++) {
    await db.collection('goals').doc(`${uid1}_goal${i}`).set({
      userId: uid1,
      title: `Legacy goal ${i}`,
      completed: false,
      createdAt: now,
    });
  }

  // --- legacyManualPro (manually-assigned paid plan, no real billing record) ---
  const uid2 = 'seed_legacy_manual_pro';
  await ensureUser(auth, uid2, 'legacy-manual-pro@staging.test');
  await db.collection('users').doc(uid2).set({
    email: 'legacy-manual-pro@staging.test',
    subscriptionPlan: 'pro',
    createdAt: now,
  });
  await db.collection('goals').doc(`${uid2}_goal1`).set({
    userId: uid2,
    title: 'Manual-pro goal 1',
    completed: false,
    createdAt: now,
  });

  // --- freshFreeUser (already fully backfilled; migration should skip) ---
  const uid3 = 'seed_fresh_free_user';
  await ensureUser(auth, uid3, 'fresh-free-user@staging.test');
  await db.collection('users').doc(uid3).set({
    email: 'fresh-free-user@staging.test',
    subscriptionPlan: 'free',
    createdAt: now,
  });
  await db.collection('goals').doc(`${uid3}_goal1`).set({
    userId: uid3,
    title: 'Fresh user goal 1',
    completed: false,
    createdAt: now,
  });
  await db.collection('usage').doc(uid3).set({ uid: uid3, activeGoalCount: 1, updatedAt: now });
  await db.collection('entitlements').doc(uid3).set({
    uid: uid3,
    plan: 'free',
    source: 'free',
    maxActiveGoals: 2,
    hasAdvertising: true,
    updatedAt: now,
  });

  console.log(`Seeded 3 synthetic fixture users into ${projectId}:`);
  console.log(`  ${uid1} — legacy Free user with 3 active goals (over new 2-goal limit)`);
  console.log(`  ${uid2} — legacy manually-assigned Pro plan, no billing record`);
  console.log(`  ${uid3} — fresh Free user, already fully backfilled (migration should skip)`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});

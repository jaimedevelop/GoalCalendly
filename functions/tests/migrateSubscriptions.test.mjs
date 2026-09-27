/**
 * Migration script integration tests (admin_subscriptions.md section 10, step 9).
 *
 * Seeds representative synthetic legacy records directly against the
 * Firestore emulator (bypassing rules, exactly as an Admin SDK migration
 * would), then actually invokes migrateSubscriptions.ts's exported main
 * logic via a child process (dry-run, then apply, then re-apply) and
 * inspects the resulting Firestore state — proving it backfills usage
 * counters, migrates legacy paid plans to complimentary grants, and does
 * NOT duplicate grants or overwrite newer state on a second run.
 *
 * Requires the Firestore + Auth emulators running.
 * Run with: node --test functions/tests/migrateSubscriptions.test.mjs
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'demo-goalcalendly';
const JOURNAL_PATH = 'migration-test-journal.json';

let db;

before(() => {
  initializeApp({ projectId: PROJECT_ID });
  db = getFirestore();
});

after(() => {
  if (existsSync(JOURNAL_PATH)) unlinkSync(JOURNAL_PATH);
});

function runMigration(extraArgs) {
  // shell: true on Windows routes through cmd.exe, which re-tokenizes the
  // argv array by whitespace — a multi-word value like "test migration"
  // would otherwise silently split into two args. Quote every arg value
  // ourselves so cmd.exe's tokenizer sees them as single tokens.
  const quoted = extraArgs.map((a) => (a.includes(' ') ? `"${a}"` : a));
  const out = execFileSync(
    'npx',
    ['tsx', 'functions/scripts/migrateSubscriptions.ts', '--env', PROJECT_ID, '--journal', JOURNAL_PATH, ...quoted],
    { encoding: 'utf8', cwd: process.cwd(), shell: true, env: process.env }
  );
  return out;
}

async function clearCollections() {
  const collections = ['users', 'goals', 'usage', 'entitlements', 'billingSummaries', 'complimentaryGrants'];
  for (const name of collections) {
    const snap = await db.collection(name).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

test('dry run reports the expected actions without writing anything', async () => {
  await clearCollections();

  await db.collection('users').doc('legacy_free').set({ uid: 'legacy_free', email: 'free@example.com', subscriptionPlan: 'free' });
  await db.collection('goals').add({ userId: 'legacy_free', completed: false });
  await db.collection('goals').add({ userId: 'legacy_free', completed: true });

  await db.collection('users').doc('legacy_paid').set({ uid: 'legacy_paid', email: 'paid@example.com', subscriptionPlan: 'pro' });

  runMigration(['--dry-run']);

  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'));
  assert.equal(journal.mode, 'dry-run');
  // Both legacy_free (1 active goal, missing usage doc) and legacy_paid (0
  // goals, also missing a usage doc) get a backfill-usage action — a user
  // with zero goals still gets their usage doc created, which is correct.
  assert.equal(journal.actionCounts['backfill-usage'], 2, 'both seeded users are missing a usage doc');
  const legacyFreeUsageAction = journal.actions.find((a) => a.uid === 'legacy_free' && a.type === 'backfill-usage');
  assert.equal(legacyFreeUsageAction.detail, 'missing -> 1', 'legacy_free has exactly 1 active goal');
  assert.equal(journal.actionCounts['migrate-legacy-paid-plan'], 1, 'legacy_paid has no billing/grant record backing its paid plan');
  assert.equal(journal.actionCounts['backfill-entitlement'], 1, 'legacy_free has no entitlement doc yet');

  // Dry run must not have written anything.
  const usageSnap = await db.collection('usage').doc('legacy_free').get();
  assert.equal(usageSnap.exists, false);
  const grantSnap = await db.collection('complimentaryGrants').doc('legacy_paid').get();
  assert.equal(grantSnap.exists, false);
});

test('apply actually writes the backfilled usage, entitlement, and complimentary grant', async () => {
  await clearCollections();

  await db.collection('users').doc('legacy_free').set({ uid: 'legacy_free', email: 'free@example.com', subscriptionPlan: 'free' });
  await db.collection('goals').add({ userId: 'legacy_free', completed: false });
  await db.collection('goals').add({ userId: 'legacy_free', completed: false });
  await db.collection('goals').add({ userId: 'legacy_free', completed: true });

  await db.collection('users').doc('legacy_paid').set({ uid: 'legacy_paid', email: 'paid@example.com', subscriptionPlan: 'platinum' });

  runMigration(['--apply', '--expiry-days', '30', '--reason', 'test migration']);

  const usageSnap = await db.collection('usage').doc('legacy_free').get();
  assert.equal(usageSnap.data().activeGoalCount, 2, 'only non-completed goals count as active');

  const freeEntitlement = await db.collection('entitlements').doc('legacy_free').get();
  assert.equal(freeEntitlement.data().plan, 'free');
  assert.equal(freeEntitlement.data().source, 'free');

  const grant = await db.collection('complimentaryGrants').doc('legacy_paid').get();
  assert.equal(grant.data().plan, 'platinum');
  assert.equal(grant.data().reason, 'test migration');
  assert.ok(grant.data().expiresAt, 'a 30-day expiry should have been set');

  const paidEntitlement = await db.collection('entitlements').doc('legacy_paid').get();
  assert.equal(paidEntitlement.data().plan, 'platinum');
  assert.equal(paidEntitlement.data().source, 'complimentary');
});

test('re-running apply does not duplicate the grant or overwrite it with different data', async () => {
  // Continues from the previous test's applied state (same emulator session).
  const grantBefore = (await db.collection('complimentaryGrants').doc('legacy_paid').get()).data();

  runMigration(['--apply', '--expiry-days', '30', '--reason', 'test migration']);

  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'));
  // Nothing left to migrate: legacy_paid already has a complimentaryGrants
  // record, so it's no longer picked up by the "legacy paid plan" check, and
  // legacy_free already has both a usage doc and an entitlement doc.
  assert.equal(journal.actionCounts['migrate-legacy-paid-plan'] ?? 0, 0, 'must not re-migrate a user who already has a grant');
  assert.equal(journal.actionCounts['backfill-entitlement'] ?? 0, 0, 'must not re-backfill an entitlement that already exists');

  const grantAfter = (await db.collection('complimentaryGrants').doc('legacy_paid').get()).data();
  assert.deepEqual(grantAfter, grantBefore, 're-running must not duplicate or alter the existing grant');
});

test('a user with a real billingSummaries record is never treated as a legacy manual grant', async () => {
  await clearCollections();

  await db.collection('users').doc('real_subscriber').set({ uid: 'real_subscriber', email: 'sub@example.com', subscriptionPlan: 'pro' });
  await db.collection('billingSummaries').doc('real_subscriber').set({ uid: 'real_subscriber', status: 'active', plan: 'pro', interval: 'month', cancelAtPeriodEnd: false });

  runMigration(['--dry-run']);

  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'));
  assert.equal(journal.actionCounts['migrate-legacy-paid-plan'] ?? 0, 0, 'a real paying subscriber must not be converted to a complimentary grant');
});

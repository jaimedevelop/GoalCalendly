#!/usr/bin/env node
/**
 * Dry-run-first migration of legacy plans and active-goal counters
 * (admin_subscriptions.md section 2/9, step 9).
 *
 * For every user profile:
 * 1. Backfills usage/{uid}.activeGoalCount from actual goal documents
 *    (completed !== true), so the server-enforced quota has an accurate
 *    starting point even for users who signed up before usage tracking existed.
 * 2. Backfills entitlements/{uid} if missing, from computeEffectiveEntitlement.
 * 3. Any user with subscriptionPlan !== 'free' but NO billingSummaries record
 *    (i.e. a manually-assigned paid plan predating Stripe integration — never
 *    evidence of payment, per section 2) gets migrated to an explicit
 *    complimentaryGrants record instead of continuing to trust the raw
 *    subscriptionPlan field. Requires an explicit default expiry policy
 *    decision (see --expiry-days) rather than silently granting permanent
 *    free access.
 *
 * Usage (run from functions/, after `npm run build`):
 *   tsx scripts/migrateSubscriptions.ts --env <project-id> --dry-run
 *   tsx scripts/migrateSubscriptions.ts --env <project-id> --apply --expiry-days 30 --reason "legacy plan migration"
 *
 * --dry-run (default unless --apply is passed) never writes anything — it
 * only prints what it would do, including a summary count per action type.
 * Safe to re-run: already-migrated users (those with a usage doc AND an
 * entitlement doc AND, if paid, a complimentaryGrants or billingSummaries
 * record) are skipped, so re-running does not duplicate grants or overwrite
 * newer state — verified by tests/migrateSubscriptions.test.mjs.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { writeFileSync } from 'node:fs';
import { computeEffectiveEntitlement } from '../src/lib/entitlements.js';
import { isGoalActive } from '../../shared/subscriptionPlans.js';
import type { SubscriptionPlanId } from '../../shared/subscriptionPlans.js';

interface Args {
  projectId: string;
  apply: boolean;
  expiryDays: number | null;
  reason: string;
  journalPath: string;
}

function parseArgs(): Args {
  const get = (flag: string) => {
    const idx = process.argv.indexOf(flag);
    return idx >= 0 ? process.argv[idx + 1] : undefined;
  };
  const projectId = get('--env');
  if (!projectId) throw new Error('Pass --env <firebase-project-id> explicitly. There is no default.');

  const apply = process.argv.includes('--apply');
  const expiryDaysArg = get('--expiry-days');
  const expiryDays = expiryDaysArg ? Number(expiryDaysArg) : null;
  const reason = get('--reason') ?? 'Legacy manually-assigned plan migrated to reviewed complimentary access';
  const journalPath = get('--journal') ?? `migration-journal-${projectId}-${Date.now()}.json`;

  if (apply && expiryDays === null) {
    throw new Error('Pass --expiry-days <N> (or --expiry-days 0 for a reviewed permanent grant) when using --apply, so legacy paid plans are never silently granted for free indefinitely by omission.');
  }

  return { projectId, apply, expiryDays, reason, journalPath };
}

interface MigrationAction {
  uid: string;
  type: 'backfill-usage' | 'backfill-entitlement' | 'migrate-legacy-paid-plan' | 'skip';
  detail: string;
}

async function main() {
  const args = parseArgs();

  if (getApps().length === 0) {
    initializeApp({ projectId: args.projectId });
  }
  const db = getFirestore();
  const auth = getAuth();

  console.log(`Migration ${args.apply ? '(APPLY MODE)' : '(DRY RUN — no writes)'} for project=${args.projectId}`);

  const usersSnap = await db.collection('users').get();
  const actions: MigrationAction[] = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const profile = userDoc.data() as { subscriptionPlan?: SubscriptionPlanId; email?: string };

    const [usageSnap, entitlementSnap, billingSnap, grantSnap, goalsSnap] = await Promise.all([
      db.collection('usage').doc(uid).get(),
      db.collection('entitlements').doc(uid).get(),
      db.collection('billingSummaries').doc(uid).get(),
      db.collection('complimentaryGrants').doc(uid).get(),
      db.collection('goals').where('userId', '==', uid).get(),
    ]);

    // 1. Backfill usage counter.
    const actualActiveCount = goalsSnap.docs.filter((g) => isGoalActive(g.data() as { completed?: boolean })).length;
    const recordedCount = usageSnap.exists ? (usageSnap.data()?.activeGoalCount as number | undefined) : undefined;
    if (recordedCount !== actualActiveCount) {
      actions.push({ uid, type: 'backfill-usage', detail: `${recordedCount ?? 'missing'} -> ${actualActiveCount}` });
      if (args.apply) {
        await db.collection('usage').doc(uid).set({ uid, activeGoalCount: actualActiveCount, updatedAt: new Date().toISOString() });
      }
    }

    // 2. Determine if this is a legacy manually-assigned paid plan.
    const isLegacyPaidPlan = profile.subscriptionPlan && profile.subscriptionPlan !== 'free' && !billingSnap.exists && !grantSnap.exists;

    if (isLegacyPaidPlan) {
      let isTrustedAdmin = false;
      try {
        const userRecord = await auth.getUser(uid);
        isTrustedAdmin = userRecord.customClaims?.admin === true;
      } catch {
        // Deleted/unknown auth user — still migrate the Firestore-side data below.
      }

      if (!isTrustedAdmin) {
        const expiresAt = args.expiryDays && args.expiryDays > 0
          ? new Date(Date.now() + args.expiryDays * 24 * 60 * 60 * 1000).toISOString()
          : undefined;

        actions.push({
          uid,
          type: 'migrate-legacy-paid-plan',
          detail: `${profile.subscriptionPlan} -> complimentary grant${expiresAt ? ` (expires ${expiresAt})` : ' (permanent, reviewed)'}`,
        });

        if (args.apply) {
          const now = new Date().toISOString();
          await db.collection('complimentaryGrants').doc(uid).set({
            uid,
            plan: profile.subscriptionPlan,
            ...(expiresAt ? { expiresAt } : {}),
            grantedBy: 'migration-script',
            reason: args.reason,
            createdAt: now,
          });

          const entitlement = computeEffectiveEntitlement({
            isTrustedAdmin: false,
            complimentaryGrant: { plan: profile.subscriptionPlan as SubscriptionPlanId, expiresAt },
          });
          await db.collection('entitlements').doc(uid).set({
            uid,
            plan: entitlement.plan,
            source: entitlement.source,
            maxActiveGoals: entitlement.maxActiveGoals,
            hasAdvertising: entitlement.hasAdvertising,
            ...(entitlement.expiresAt ? { expiresAt: entitlement.expiresAt } : {}),
            updatedAt: now,
          });
        }
        continue; // entitlement handled above; skip the generic backfill-entitlement branch below
      }
    }

    // 3. Backfill entitlement for anyone who still doesn't have one (Free
    // users, or admins who were never migrated through createFreeProfile).
    if (!entitlementSnap.exists) {
      let isTrustedAdmin = false;
      try {
        const userRecord = await auth.getUser(uid);
        isTrustedAdmin = userRecord.customClaims?.admin === true;
      } catch {
        // proceed as non-admin
      }

      actions.push({ uid, type: 'backfill-entitlement', detail: isTrustedAdmin ? 'admin' : 'free' });
      if (args.apply) {
        const entitlement = computeEffectiveEntitlement({ isTrustedAdmin });
        await db.collection('entitlements').doc(uid).set({
          uid,
          plan: entitlement.plan,
          source: entitlement.source,
          maxActiveGoals: entitlement.maxActiveGoals,
          hasAdvertising: entitlement.hasAdvertising,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  const summary = {
    projectId: args.projectId,
    mode: args.apply ? 'apply' : 'dry-run',
    totalUsers: usersSnap.size,
    actionCounts: actions.reduce<Record<string, number>>((acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + 1;
      return acc;
    }, {}),
    actions,
    ranAt: new Date().toISOString(),
  };

  writeFileSync(args.journalPath, JSON.stringify(summary, null, 2) + '\n');
  console.log(`\nSummary: ${JSON.stringify(summary.actionCounts, null, 2)}`);
  console.log(`Full journal written to ${args.journalPath}`);
  if (!args.apply) {
    console.log('\nThis was a DRY RUN — no data was written. Re-run with --apply --expiry-days <N> to apply.');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message ?? err);
  process.exit(1);
});

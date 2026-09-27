# Deployment runbook

For Goal Calendly. Written during Step 10 (staging rehearsal), updated September 27, 2026. This is the actual record of what has been verified against real deployed infrastructure, not a plan — see [admin_subscriptions.md](./admin_subscriptions.md) for the plan this executes and [credentials.md](./credentials.md) for account setup.

## Environments

| Environment | Firebase project ID | Status |
| --- | --- | --- |
| Local/emulator | `demo-goalcalendly` (demo project ID, no real cloud resources) | Used for all automated tests |
| Staging | `goal-calendly-staging` | Stood up 2026-09-27 this session. Blaze plan. Functions + Firestore + Auth deployed and verified live. No frontend hosting deployed yet. |
| Production | `goal-calendly` | Live. Functions + Firestore deployed. Frontend live at `https://goal-calendly.web.app`. Real users exist (2 as of this session). Checkout disabled (`CHECKOUT_ENABLED=false`). |

Both staging and production currently point at the **same Stripe test-mode account** (Products/Prices from step 5's provisioning). This was a deliberate choice this session — Stripe test mode has no real customer data to isolate between environments, so a second Stripe test account was judged unnecessary. If live Stripe resources are ever provisioned for production (step 11), staging must **never** be pointed at them.

Region: `us-central1` for all functions in both projects. Runtime: Node.js 20 (2nd Gen) — **note the deprecation warning below**.

### Known housekeeping item (non-blocking)

Every staging/production deploy currently prints:
> Runtime Node.js 20 was deprecated on 2026-04-30 and will be decommissioned on 2026-10-30.
> package.json indicates an outdated version of firebase-functions.

Node 20 will stop deploying entirely after **2026-10-30**. Upgrade `functions/package.json`'s runtime and `firebase-functions` dependency (breaking changes expected) before that date, in its own reviewed change — not folded into a billing-feature deploy.

## Staging setup performed this session (2026-09-27)

Starting state: `goal-calendly-staging` existed as a bare Firebase project with no APIs enabled, no billing plan, no Authentication, no Firestore database, and no functions.

Steps actually run, in order (for reproducing this on a future new environment):

1. Upgraded the project to the Blaze plan in Firebase Console (required before any Cloud Functions API can be enabled — the CLI's own enable-on-deploy flow refuses on the Spark plan even after upgrade, until the billing link fully propagates; this took several retries over ~20 minutes in practice).
2. `firebase deploy --only functions --project goal-calendly-staging` — this single command auto-enabled `cloudfunctions.googleapis.com`, `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `cloudscheduler.googleapis.com`, `run.googleapis.com`, `eventarc.googleapis.com`, `pubsub.googleapis.com`, `storage.googleapis.com`, `secretmanager.googleapis.com`, and `firebaseextensions.googleapis.com` as a side effect. It first failed because the two Stripe secrets didn't exist yet on this project (Secret Manager is per-project, not shared across `goal-calendly`/`goal-calendly-staging`).
3. Bound secrets:
   ```
   firebase functions:secrets:set STRIPE_SECRET_KEY --project goal-calendly-staging
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project goal-calendly-staging
   ```
   (both prompt for stdin input — never pass secret values as a command-line argument or write them to a file). `STRIPE_SECRET_KEY` reused production's test-mode key. `STRIPE_WEBHOOK_SECRET` started as a placeholder to unblock the first deploy, then was replaced with the real value once step 5 below existed.
4. `firebase deploy --only functions --project goal-calendly-staging` again — succeeded, created all 16 functions (17 after this session added `setGoalWritesPaused`).
5. `firebase functions:artifacts:setpolicy --project goal-calendly-staging` — sets a 1-day container-image cleanup policy (otherwise old container images accumulate storage cost silently; the first deploy warns about this and is easy to miss).
6. Enabled **Authentication** (Email/Password provider) in Firebase Console — the Admin SDK's `createUser`/`createCustomToken` calls fail with `auth/configuration-not-found` until this is done manually; there is no CLI command for it.
7. `firebase deploy --only firestore:rules,firestore:indexes --project goal-calendly-staging` — this also silently created the actual Firestore database (`(default)`) as a side effect of `firestore.googleapis.com` being auto-enabled; there was no separate "create database" step needed.
8. Registered a **new** Stripe webhook destination in the Stripe test-mode dashboard pointed at `https://us-central1-goal-calendly-staging.cloudfunctions.net/stripeWebhook` (same event types as production's existing destination). Retrieved its `whsec_...` signing secret and re-bound `STRIPE_WEBHOOK_SECRET`, then redeployed just `stripeWebhook` to pick it up:
   ```
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project goal-calendly-staging
   firebase deploy --only functions:stripeWebhook --project goal-calendly-staging
   ```
   **Production's existing webhook destination was left untouched and still points only at production.** Staging has its own separate destination and its own separate signing secret — they must never be swapped.
9. `firebase apps:create web goal-calendly-staging-web --project goal-calendly-staging` — registered a web app (needed to obtain an API key for any client-side sign-in flow, including the custom-token exchange used below; there had been zero apps registered).
10. Wrote `functions/.env.goal-calendly-staging` (gitignored, non-secret Price IDs/`APP_ORIGIN`/`CHECKOUT_ENABLED=false`), modeled on the existing `.env.goal-calendly`.

## Verified against real staging infrastructure this session

- **Webhook delivery**: a genuinely Stripe-signed test event (`Stripe.webhooks.generateTestHeaderString`, real signing secret) posted to staging's live `stripeWebhook` URL returned `200 ok`, and `stripeEvents/{eventId}` was written with `status: "processed"` in staging's real Firestore. Mirrors the equivalent production verification from the prior session (`evt_test_tywe5y4x5vm`).
- **Migration script** (`functions/scripts/migrateSubscriptions.ts`) against real staging fixtures (seeded via the new `functions/scripts/seedStagingFixtures.ts` — see below):
  - `--dry-run` correctly identified: a legacy Free user with 3 active goals (needs usage/entitlement backfill only, keeps all 3 goals), a legacy manually-assigned Pro plan with no real billing record (needs conversion to an audited complimentary grant), and a fully-current Free user (correctly produced zero actions).
  - `--apply --expiry-days 30` wrote the expected records — verified by reading them back directly from staging Firestore.
  - Re-running `--dry-run` immediately after `--apply` produced an **empty** summary, confirming re-runs don't duplicate grants or re-touch already-migrated users.
  - Also ran `--dry-run` against real **production** (`goal-calendly`) accounts: 2 real users, both missing usage/entitlement docs (would be backfilled to `admin` and `free` respectively), neither needs a legacy-plan migration. No `--apply` was run against production — that is step 11's job, during the actual cutover maintenance window, not this rehearsal.
- **Write-pause switch** (`systemFlags/goalWritesPaused`) — **this did not exist before this session**; see "Gap found and fixed" below. Verified: the flag can be set to `paused: true` and back to `false` directly against staging's real Firestore, and (separately, via the local emulator, since the exact same deployed code is what runs on staging) `mutateGoals` correctly rejects every mutation type — including non-quota-affecting ones like `delete` — while paused, and resumes normal operation immediately once unpaused.
- **Section 5 payment/security/concurrent-goal checks**: covered by the full automated suite (44 tests, all passing) run against the emulator with the exact code now deployed to staging: `functions/tests/stripeWebhook.test.mjs` (6 — signed event acceptance, forged-signature rejection, replay idempotency, cancellation revocation, unmapped-customer skip, missing-subscription-link skip), `functions/tests/goalLimits.test.mjs` (8 — limit enforcement, concurrent-device race, replay dedup, atomic batch rejection, legacy over-limit non-destructive policy, reopen validation, unauthenticated rejection, write-pause), `tests/firestore.rules.test.mjs` (11 — profile escalation, cross-user reads, backend-only collections including the new `systemFlags`, unauthenticated rejection), `functions/tests/checkoutAndPortal.test.mjs` (4 — Checkout-disabled rejection, invalid plan, no-billing-account, unauthenticated), `functions/tests/adminAccessManagement.test.mjs` and `functions/tests/migrateSubscriptions.test.mjs` (admin-claim enforcement, migration idempotency against synthetic records). Run with:
  ```
  npm run test:emulator-suite
  ```
  (requires the Functions+Firestore+Auth emulators running, and `STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_*`/`STRIPE_SECRET_KEY` exported to match `functions/.env.demo-goalcalendly` — the test *script's own process* does not auto-load that file, only the emulator does; export it manually first:
  ```
  export $(grep -v '^#' functions/.env.demo-goalcalendly | xargs)
  ```
  on Windows Git Bash, or the PowerShell equivalent.)
- **Reconciliation alert wiring**: a Cloud Monitoring log-based alert on `reconcileSubscriptionsScheduled` error-severity log entries, with an email notification channel, was created for `goal-calendly-staging` directly in Google Cloud Console (no CLI available for this in the working environment — no `gcloud` installed). A deliberately-broken `billingCustomers` record (pointing at a nonexistent Stripe subscription ID, `seed_reconcile_failure_target`) was seeded on staging to make the next reconciliation run fail on purpose.

## Not yet completed — genuine open items

- ~~Reconciliation alert not yet confirmed~~ — **confirmed 2026-09-27.** The scheduled job fired on its own real hourly schedule 5 times (no manual trigger needed — it just runs), correctly erroring on the seeded bad record (`billingCustomers/seed_reconcile_failure_target`, "No such subscription") every time, and the alert email arrived. The fixture has been deleted so it stops paging on a real schedule going forward.
- ~~No staging frontend deployed~~ / ~~Rollback not physically rehearsed~~ — **both done 2026-09-27**, see the incident report and rollback drill sections below.
- **Live HTTP-level rehearsal of the write-pause and Checkout-disable switches, specifically via a signed-in browser session against the deployed staging frontend, is still open.** A staging frontend now exists (see below), so this can be done directly through the UI: sign in on `https://goal-calendly-staging.web.app`, have an admin flip `setGoalWritesPaused`/`CHECKOUT_ENABLED`, and confirm the UI reflects the blocked state. Not yet performed.
- **Advertising and offline checks from section 5, and a genuine old-client-refresh drill**, have not been run yet now that a real staging frontend exists to run them against.

## Incident: a staging deploy overwrote production hosting (2026-09-27, caught and fixed same session)

**What happened:** `firebase.json`'s `hosting` config was a single object hardcoded to `"site": "goal-calendly"` (production's site). When staging's frontend was first built and deployed with `firebase deploy --only hosting --project goal-calendly-staging`, the `--project` flag only changed which project the CLI authenticated against — it did **not** change which hosting *site* got the deploy, because `firebase.json` had no staging site configured at all. The result: a build configured to talk to the staging Firebase backend (staging Firestore, staging Auth, staging Functions) was deployed live to `https://goal-calendly.web.app` — production's real URL.

**How it was caught:** immediately, by independently verifying the deployed asset hash against what was expected, rather than trusting the CLI's success output alone. The CLI's own output (`hosting[goal-calendly]: release complete` / `Hosting URL: https://goal-calendly.web.app`) was the tell — it should have read `goal-calendly-staging` and didn't.

**How it was fixed:**
1. Immediately rebuilt from committed source using the real production `.env` (default Vite mode, not `--mode staging`) and redeployed to `--project goal-calendly` — restored within minutes, verified by checking the live asset hash matched the rebuild.
2. Root-caused properly rather than just re-trying more carefully next time:
   - Added explicit project aliases to `.firebaserc`: `staging` → `goal-calendly-staging`, `production` → `goal-calendly` (alongside the existing unchanged `default` → `goal-calendly`).
   - Added Hosting deploy **targets** (`firebase target:apply hosting production goal-calendly` / `firebase target:apply hosting staging goal-calendly-staging`), which map a target name to a specific site *per project*, independent of `--project`.
   - Converted `firebase.json`'s `hosting` key from a single object to a **two-entry array**, each keyed by `"target"` (`production` / `staging`) instead of a bare `"site"` string.
   - This makes `firebase deploy --only hosting` **fail outright** (no bare hosting target exists anymore) — every hosting deploy must now say `--only hosting:production` or `--only hosting:staging` explicitly, so this specific mistake can no longer happen silently.
   - Verified both targets resolve to the correct site using `firebase deploy --only hosting:<target> --project <project> --dry-run` (a real, working flag) **before** doing either deploy for real.

**Lesson for any future multi-environment Firebase Hosting setup:** never assume `--project` scopes a hosting deploy. Set up explicit deploy targets from the start, and dry-run the first deploy to a new target before trusting it.

## Rollback drill (2026-09-27, staging)

Rehearsed for real, not just reasoned through:

1. Deployed the current (good) staging build to a preview channel (`firebase hosting:channel:deploy pre-rollback-drill --only staging`) — this freezes that exact version, addressable independently of whatever `live` later becomes.
2. Deployed a deliberately-broken release to `live` (a distinctive fake `<title>ROLLBACK-DRILL-DELIBERATE-BAD-RELEASE</title>`, built directly into `dist/index.html` for this drill only — never committed to source). Verified via `curl` that the bad title was actually being served.
3. Rolled back using `firebase hosting:clone goal-calendly-staging:pre-rollback-drill goal-calendly-staging:live` — Firebase Hosting's native mechanism for promoting one channel's exact content onto another.
4. Verified via `curl` that `live` was back to the correct title, and **independently re-verified production was untouched throughout** (checked its own title/asset hash at every step of this drill, not just at the end).
5. Deleted the temporary `pre-rollback-drill` channel afterward.

This is the pattern to use for a real production rollback: `firebase hosting:channel:deploy <name> --only production` to freeze a known-good version before a risky deploy, then `firebase hosting:clone <site>:<name> <site>:live` to restore it if the new deploy goes wrong. For functions, the equivalent is redeploying from a prior known-good git commit (`firebase deploy --only functions --project <project>` with that commit checked out) — Cloud Run (which 2nd-gen functions run on) keeps prior numbered revisions (confirmed: `mutategoals-00001-qob` through `-00003-gos` exist from this session's deploys alone), so a specific prior revision can also be promoted back to 100% traffic directly in the Cloud Run console without a rebuild, when that revision is still warm.

## Staging frontend deployment (2026-09-27)

Built and deployed for the first time this session:
```
npx vite build --mode staging   # reads .env.staging (gitignored, non-secret web config)
firebase deploy --only hosting:staging --project goal-calendly-staging
```
`.env.staging` holds staging's Firebase web app config (API key, project ID, etc.) — obtained by first registering a web app on the staging project (`firebase apps:create web goal-calendly-staging-web --project goal-calendly-staging`; none existed before this session) and reading its config (`firebase apps:sdkconfig WEB <app-id> --project goal-calendly-staging`).

Live at `https://goal-calendly-staging.web.app`. Talks to the staging backend end-to-end (staging Firestore/Auth/Functions) — this is the first time the full stack (frontend + backend) has existed together on staging.
- **Live HTTP-level rehearsal of the write-pause switch and the Checkout enable/disable switch could not be completed against the real deployed staging endpoints in this session.** Both are fully covered by passing automated tests against the identical deployed code, and the write-pause flag itself was verified read/write against real staging Firestore — but neither was exercised via an actual signed-in HTTP call to the live staging function. This is because minting a custom Firebase Auth token for a synthetic user requires either a real service-account key file or `iam.serviceAccounts.signBlob` permission delegated to the calling identity, and this working environment only had the Firebase CLI's own interactive OAuth login available (no `gcloud`, no service-account key file, no `GOOGLE_APPLICATION_CREDENTIALS`). **To close this gap:** either (a) sign in through the real staging frontend once one is deployed and click through Checkout/goal-creation manually while an admin flips the switches, or (b) generate a scoped service-account key for staging test automation specifically (never for production) and re-run an HTTP-level version of these checks.
- **No staging frontend is deployed.** All verification this session was backend-only (functions + Firestore, driven via Admin SDK scripts and direct signed HTTP calls to `stripeWebhook`). A staging frontend hosting target (Firebase Hosting site, distinct from production's `goal-calendly` site) has not been created. `functions/.env.goal-calendly-staging`'s `APP_ORIGIN` is a placeholder (`https://goal-calendly-staging.web.app`) pointing at a URL that does not yet serve anything.
- **Rollback has been reasoned through but not physically rehearsed** (e.g., redeploying an older functions version, or reverting rules) — there was no prior staging deployment to roll back *to* until this session created the first one. A genuine rollback rehearsal now has something to roll back to; it should be done as a separate, deliberate drill (deploy a trivial change, then roll back to the current known-good revision) before step 11.
- **Old-client-refresh drill** (serving a stale cached frontend build against newly-deployed rules that deny the old direct-write path) has not been rehearsed, since no staging frontend build exists yet.

## Gap found and fixed this session: no goal-write-pause mechanism existed

Section 9's production cutover step 3 requires "deny client goal writes and pause backend goal mutations" during the counter-migration maintenance window. Before this session, **no such mechanism existed anywhere in the code** — `mutateGoals.ts` had no check for any kind of pause state, and the only existing kill-switch (`CHECKOUT_ENABLED`) is a build-time env var requiring a full redeploy to flip, which would make a real maintenance window take several minutes longer than necessary and isn't truly instant.

Fixed by adding:
- `functions/src/admin/maintenanceFlags.ts` — `setGoalWritesPaused` callable (admin-only, audited via `adminAuditLogs`, same pattern as `deactivateAccount`/`grantComplimentaryAccess`). Writes `systemFlags/goalWritesPaused` — an instant Firestore document flip, no redeploy needed to pause or resume.
- `functions/src/goals/mutateGoals.ts` — checks that flag first, before any other validation, and fails closed (`HttpsError('unavailable', ...)`) when paused. Applies to **every** mutation type, including non-quota-affecting ones (edit/complete/delete), matching a real maintenance window that freezes all goal writes, not just ones that could exceed the limit.
- `firestore.rules` — `systemFlags/{flagId}`: admin-readable (for an eventual ops dashboard), backend-write-only.
- Test coverage: `functions/tests/goalLimits.test.mjs` ("a maintenance-window pause blocks all goal writes, and resuming restores them") and `tests/firestore.rules.test.mjs` ("systemFlags ... is admin-readable but backend-only to write").

This is a real, previously-missing piece of the migration-safety story, not a cosmetic addition — deploy it to production (already deployed to staging as part of this session's work) before ever attempting the real step 11 cutover's write-pause window.

## Rollback

General principle (section 9): disable Checkout server-side first if something's wrong; keep webhooks/reconciliation/Portal running if they're healthy; never restore owner-writable billing/goal fields to bypass a completed migration; a code rollback never undoes a real charge.

Concretely, for a functions-only rollback:
```
firebase deploy --only functions --project <project-id>
```
with the working tree checked out at the last known-good commit. Firebase Functions does not have a built-in one-command "rollback to previous revision" — Cloud Run (which 2nd-gen functions run on) keeps prior revisions, so a specific prior revision can also be promoted back to 100% traffic directly in the Cloud Run console per function, without a rebuild, if the previous revision is still warm. This is faster than a redeploy when available but isn't guaranteed (old revisions get scaled to zero and eventually cleaned up).

For rules:
```
firebase deploy --only firestore:rules --project <project-id>
```
Firestore rules deploys are versioned in Firebase Console (Firestore → Rules → History) and can be reverted to any prior published version directly there without needing the old `firestore.rules` file on disk.

**Not yet physically rehearsed** — see open items above.

## Support runbook: common cases

- **Charged but not upgraded**: check `stripeEvents/{eventId}` for the relevant checkout/subscription event — if missing, the webhook never arrived (check Stripe's dashboard delivery log for that endpoint) or was rejected (check function logs for a 400). Use `reconcileOneCustomer` (admin-only callable, takes a `uid`) to force a resync from live Stripe state without waiting for the next scheduled run.
- **Duplicate subscription**: `createCheckoutSession` refuses a second Checkout for a caller with an existing active/past_due/trialing subscription — if one exists anyway, it was created outside the app's own Checkout flow. Resolve directly in Stripe (cancel the extra one), then run `reconcileOneCustomer` for that UID.
- **Cancellation dispute**: check `billingCustomers/{uid}` for `cancelAtPeriodEnd` and `paidThroughDate` — access is retained through the paid-through date per policy; this is not a bug.
- **Refund vs. cancellation**: a refund does not by itself change subscription status or entitlement — handle the entitlement change (if any) as its own explicit action; never assume a refund implies cancellation or vice versa.

## Reference: rehearsal scripts added this session

- `functions/scripts/seedStagingFixtures.ts` — seeds 3 synthetic users into a real Firebase project (refuses to run against `goal-calendly` by name, as a safety check) representing a legacy over-limit Free user, a legacy manually-assigned paid plan, and a fully-current user. Usage: `tsx scripts/seedStagingFixtures.ts --env goal-calendly-staging`.

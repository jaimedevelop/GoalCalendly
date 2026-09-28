# Deployment runbook

For Goal Calendly. Written during Step 10 (staging rehearsal), updated September 27, 2026. This is the actual record of what has been verified against real deployed infrastructure, not a plan — see [admin_subscriptions.md](./admin_subscriptions.md) for the plan this executes and [credentials.md](./credentials.md) for account setup.

## Environments

| Environment | Firebase project ID | Status |
| --- | --- | --- |
| Local/emulator | `demo-goalcalendly` (demo project ID, no real cloud resources) | Used for all automated tests |
| Staging | `goal-calendly-staging` | Stood up 2026-09-27 this session. Blaze plan. Functions + Firestore + Auth deployed and verified live. Frontend deployed at `https://goal-calendly-staging.web.app`. |
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
- ~~Live HTTP-level rehearsal of the write-pause and Checkout-disable switches~~ — **confirmed 2026-09-27, see "Live switch rehearsal" section below.**
- ~~Advertising checks~~ — **confirmed 2026-09-27**, see "Advertising and offline rehearsal" below. Real sample campaigns/advertising-ways were seeded on staging via the Admin Dashboard UI and verified rendering for a live Free-tier signup.
- ~~Old-client-refresh drill~~ — **confirmed 2026-09-27**, see "Old-client and concurrency drills" below.
- ~~Multi-device concurrent-edit conflict scenario~~ — **confirmed 2026-09-27**, see "Old-client and concurrency drills" below.

## Real bugs found and fixed this session (2026-09-27), via actual staging rehearsal

Driving the deployed staging frontend with Playwright (not just reading code) surfaced three genuine, previously-undetected bugs, all now fixed and deployed to **both staging and production**:

1. **New signups never got an `entitlements/{uid}` document, so ads never showed for any real user, ever.** `src/services/auth.ts`'s `signUp`/`signIn`/`onAuthStateChange` called the old client-side `createUserProfile()` (`src/services/user.ts`), which only ever wrote `users/{uid}`. The backend callable that actually creates both `users/{uid}` and `entitlements/{uid}` together (`functions/src/admin/manageAccess.ts`'s `createFreeProfile`, built in step 3) was never wired into the frontend. Fixed by routing all three call sites through the `createFreeProfile` callable instead. Caught because the user reported "I did not see the free advertising, nor banners, nor pop up in regular user account" after signing up on staging — verified via a fresh Playwright signup that `entitlement` resolved correctly and real seeded ad campaigns rendered on the Goals page afterward.
2. **Admin Dashboard showed the wrong admin badge/count**, based on the stale pre-migration `users/{uid}.role` Firestore field instead of the real trusted-admin custom claim. The code already computed a correct `isAdmin` variable (`user.role === 'admin' || entitlement?.source === 'admin'`) with a comment explaining exactly why — but the visible badge and the "Admins" summary tile still read `user.role` directly, so accounts with a leftover pre-migration `role: 'admin'` field (like `admin@admin.com` and, on production, the user's own account) displayed as admin even with no real claim, while a genuinely-claimed admin with `role: 'user'` would have shown as a plain user. Fixed both render sites in `src/components/AdminDashboard.tsx` to use `isAdmin`.
3. **A network/offline failure during any Firebase callable (goal mutation, Checkout, admin action) showed the user the literal word "internal"** instead of a real error message. The Firebase Functions SDK throws `code: "functions/internal"` with `message: "internal"` for a pure transport-level failure (client offline, request never reached the server) — not a real server-authored message. `src/services/goals.ts`, `src/services/billing.ts`, and `src/services/admin.ts` all trusted `.message` unconditionally, so this raw SDK string leaked straight into the UI. Fixed all three to detect `functions/internal`/`functions/unavailable` and show "You're offline. This action couldn't be completed — check your connection and try again." instead. Caught by actually taking a live Playwright session offline mid-goal-creation and reading the rendered dialog, not just by reading the code.

Also found and fixed, incidentally, while investigating (1): a missing Firestore composite index (`goals`: `type` ASC, `userId` ASC, `updatedAt` DESC) that made `loadFromFirestore` fail outright with "The query requires an index" for any real staging account — `firestore.indexes.json` had always been empty (`{"indexes": [], "fieldOverrides": []}`), so this had presumably also been silently broken on production for any account whose data made the query actually execute. Deployed to both staging and production.

**A previously-undocumented second production frontend was also discovered**: `https://goalcalendly.netlify.app`, built from the default (non-staging) `.env` and pointed at the same live `goal-calendly` Firebase project as `https://goal-calendly.web.app`. Confirmed by the user to be a leftover/test deploy, not real user traffic, but it is **not updated by this repo's `firebase deploy` commands** — it will keep serving the old, buggy frontend code (including all three bugs above) until someone redeploys it separately from Netlify. Not torn down or touched this session; flagging it here so it isn't mistaken for a synced environment later.

**Production admin claim gap closed**: `jaimegue@yahoo.com` had the same stale `role: 'admin'` Firestore field as `admin@admin.com` on production, with no real custom claim — meaning real admin-gated backend actions (grant/revoke, deactivate, etc.) were silently failing for the account the user actually uses. Granted the real `admin` custom claim via `functions/scripts/setAdminClaim.ts` against `goal-calendly` (production), audited in `adminAuditLogs`.

## Live switch rehearsal (2026-09-27)

Performed via a real authenticated HTTP session (Playwright login on `https://goal-calendly-staging.web.app`, then the browser's own persisted ID token used to call the deployed Cloud Functions directly), against a freshly-created, clearly-tracked staging test account granted the real admin claim (`functions/scripts/setAdminClaim.ts` against `goal-calendly-staging`):

- **Write-pause**: `setGoalWritesPaused({paused: true})` → `200 {ok: true, paused: true}`. A subsequent `mutateGoals` create call → `503 UNAVAILABLE, "Goal writes are temporarily paused for maintenance. Please try again shortly."` `setGoalWritesPaused({paused: false})` → `200`; the same mutation then → `200 {ok: true}`. Confirms the maintenance-window mechanism added in step 10 actually works end to end against deployed staging, not just the emulator.
- **Checkout-disable**: with staging's `CHECKOUT_ENABLED=false`, `createCheckoutSession` → `400 FAILED_PRECONDITION, "New subscriptions are temporarily unavailable. Existing billing management remains available."` The `/subscription` page correctly hides the Upgrade button rather than showing a dead one.
- Note: neither switch has an Admin Dashboard UI control yet (both are callable/env-only) — this rehearsal called the deployed Cloud Functions directly with a real user session's token rather than clicking a UI button that doesn't exist. If an ops UI for these is ever wanted, that's new scope, not a rehearsal gap.

## Old-client and concurrency drills (2026-09-27)

- **Old-client-refresh drill**: simulated a stale cached frontend bundle (from before the goal-write migration) by initializing a fresh Firebase SDK instance directly (bypassing the deployed app entirely) and attempting the pre-migration write pattern against the currently-deployed `firestore.rules`: (1) a direct `addDoc` to `goals/*` — blocked with `permission-denied`, "Missing or insufficient permissions", no partial write; (2) a direct `updateDoc` on `users/{uid}` setting `role: 'admin'` (a privilege-escalation attempt an old client might still try) — blocked the same way. Confirms an old cached client cannot silently corrupt data or escalate privilege against current rules; it fails immediately and cleanly, matching the required "old clients must refresh" behavior from section 9's production cutover step 4.
- **Concurrent-edit conflict drill**: created one goal, then fired an `update` (rename) and a `complete` mutation at the exact same goal concurrently (`Promise.all` against the live deployed `mutateGoals` endpoint, not the emulator). Both succeeded (`200 {ok: true}` each); the final document correctly reflects **both** changes (`name: "Renamed by tab A"` and `completed: true`) — Firestore's transaction retry semantics serialize the two writes rather than losing either one, since they touch different fields. No double-decrement or corruption. The existing automated suite (`functions/tests/goalLimits.test.mjs`) already covers the create-side concurrent-count-enforcement case; this drill specifically exercised the update/complete path live against deployed staging, which nothing had verified before.

## Advertising and offline rehearsal (2026-09-27)

- Seeded real sample campaigns and advertising-ways on staging via the Admin Dashboard UI (`Initialize Sample Data` buttons, driven live with Playwright, native `confirm()` dialogs auto-accepted) — 5 campaigns (4 active, 1 paused), 5 advertising-ways including an active "Modal Pop-ups ... goal-completion, milestone-based" placement.
- Verified a live Free-tier signup (after the entitlement fix above) actually renders real ad content on the Goals page (a banner and a placement, confirmed via rendered page text, not just "0 campaigns" as before the fix).
- Confirmed in code (`src/components/AdvertisingManager.tsx`) that the milestone-ad modal is gated on `!activeTimer.isRunning`, matching the step-8 fix; not re-driven live this session since it was already visually verified with Playwright in the step-8 session and nothing since then touched that code path.
- Offline resilience: took a live signed-in session offline mid-session — no crash, Firestore's realtime listener errored and recovered cleanly on reconnect, no stuck UI. Then specifically drove an offline goal-creation submission end to end: found and fixed the "internal" error-message bug (above) as a direct result. After the fix, redeployed and reconfirmed: the dialog now shows a clear, correct offline message and preserves the user's input for retry, rather than a bare, meaningless string.

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
The earlier open items are closed by the live switch rehearsal, staging frontend deployment, Hosting rollback drill, and old-client/concurrency drill documented above. Those earlier backend-only limitations no longer describe staging.

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

## Step 11 pre-flight (2026-09-27) — everything checkable without live Stripe credentials

Live Stripe business activation, live API key creation, and live Product/Price/Portal provisioning are account actions only the account owner can perform (Stripe requires human business/identity verification; a restricted API key must never be generated or held by an agent). This pre-flight covers everything else section 9's production cutover and this document's own open items call for, so step 11 can move straight to live-resource provisioning once the user completes `credentials.md` step 9 items 1-4.

### Release artifact record

| Item | Value |
| --- | --- |
| Release commit | `306c523f7d5b6f899e6eddbbe4d61d1a722b8bb8` (2026-09-27 19:11:58 -0400) — "step 10 completed it" |
| Frontend build | `npm run build` — clean, no errors, `dist/index.html` + hashed assets produced |
| Backend build | `npm --prefix functions run build` — clean, no errors |
| Working tree | Clean at time of this check; `main` up to date with `origin/main` |
| Production functions currently deployed | 15 functions (see list below), all `v2`, `us-central1`, `nodejs20` — matches step 10's post-fix state |
| Production frontend live check | `https://goal-calendly.web.app/goals` → `200`; `<title>Goal Calendly</title>` (not the rollback-drill title — confirms no leftover drill artifact) |
| Staging frontend live check | `https://goal-calendly-staging.web.app/goals` → `200` |
| Automated test evidence | Not re-run this session (no code changed since step 10's 44/44 pass, recorded above under "Section 5 payment/security/concurrent-goal checks"). Re-run `npm run test:emulator-suite` before the actual cutover if any code changes land between now and then. |

Production functions currently live (`firebase functions:list --project goal-calendly`): `checkAccountBillingStatus`, `createCheckoutSession`, `createFreeProfile`, `createPortalSession`, `deactivateAccount`, `deleteAccount`, `grantComplimentaryAccess`, `listUserAccessSummaries`, `mutateGoals`, `ping`, `reactivateAccount`, `reconcileOneCustomer`, `reconcileSubscriptionsScheduled`, `revokeComplimentaryAccess`, `stripeWebhook`, `updateOwnProfile`. `CHECKOUT_ENABLED` defaults to disabled in code (`createCheckoutSession.ts`: `process.env.CHECKOUT_ENABLED === 'true'` — any unset/non-`'true'` value is closed), matching the required "new Checkout stays off" state going into step 11.

### Backup / export

Not yet taken this session — do this immediately before the production cutover window, not now, so the backup reflects the actual pre-migration state:

```
gcloud firestore export gs://<a-backup-bucket>/goal-calendly-pre-step11-<date> --project goal-calendly
```

Requires `gcloud` (not installed in this working environment — confirmed absent during step 10 too) or running the equivalent export from Firebase/Google Cloud Console's Firestore import/export page. Record the resulting export path/timestamp in this file once taken. Firebase documents managed export/import in [Export and import data](https://firebase.google.com/docs/firestore/manage-data/export-import).

### Items from this document's own "Not yet completed" / open-items lists that block step 11 specifically

Re-checked against the lists above — everything previously open under "Not yet completed — genuine open items" is now marked resolved (2026-09-27). Two narrower items remain, both non-blocking for a live-resource provisioning pass but worth closing before the actual cutover window:

- **Node 20 deprecation** (see "Known housekeeping item" above): decommissioned 2026-10-30. If step 11's live cutover will happen close to or after that date, upgrade the functions runtime first, as its own reviewed change, and re-run the full test suite — don't fold a runtime upgrade into the same deploy as enabling live Checkout.
- **`goalcalendly.netlify.app`** (see "Incident" section above): a real, still-live, unsynced second production frontend pointed at the same live `goal-calendly` project. It will not receive any step 11 frontend deploy and will keep serving whatever code was last pushed to it directly from Netlify. Confirmed by the user to not be real user traffic, but flagging again here since step 11 is the point where this could matter (a stale frontend hitting a project with live Checkout enabled). Recommend the user either redeploy or tear it down before enabling live purchases.

### What step 11 needs from the user next (per `credentials.md` step 9)

1. Complete Stripe business activation (business/identity/payout info — entered directly in Stripe, never sent here).
2. Create the live restricted `STRIPE_SECRET_KEY` with the same permission list as the tested sandbox key.
3. Decide final launch pricing (recommended $4.99/$9.99 vs. the $3.50/$9.50 alternative in `admin_subscriptions.md` section 2) — confirm no change from the sandbox provisioning in step 5.
4. Confirm readiness to run `firebase functions:secrets:set STRIPE_SECRET_KEY --project goal-calendly` when ready (this session will guide the command; the secret value itself must be entered directly at the CLI prompt by the user, not passed through chat or written to a file).

Once those are in hand, the remaining step 11 checklist items (live Product/Price/Portal provisioning, live webhook registration, cutover sequence, first real purchase) can proceed.

## September 27 verification and corrections

This audit supersedes the earlier function count and webhook destination claims. Production initially listed 16 ACTIVE functions; setGoalWritesPaused was missing and has now been deployed successfully, giving 17. The maintenance flag itself was not changed.

The production registered test destination is `https://stripewebhook-wpkahzvajq-uc.a.run.app` (`we_1UK6cJ33BJJtidgHVWxoiJD8`). The staging test destination was absent from the current Stripe account; recreated as `https://stripewebhook-secrj7wtva-uc.a.run.app` (`we_1UKTEb33BJJtidgHg1YTcdfq`) and its secret saved to staging. Both URLs were matched to their project via Cloud Functions v2 metadata. The cloudfunctions.net aliases are callable URLs, but were not the registered destinations at audit time.

Use STRIPE_WEBHOOK_URL for exact destination verification; APP_ORIGIN is a separate frontend URL. From the repo root, with credentials loaded securely into the process environment, run `npx tsx functions/scripts/verifyStripeConfig.ts --env test` (or `--env live` for live resources). This direct command also avoids PowerShell/npm argument forwarding dropping the --env flag.

Frontend/backend builds, 17 unit/config tests, and 44 emulator tests passed. Public smoke checks passed for both Hosting sites:

```powershell
node scripts/verify-deployment.mjs https://goal-calendly.web.app goal-calendly
node scripts/verify-deployment.mjs https://goal-calendly-staging.web.app goal-calendly-staging
```

Production intentionally uses test Stripe resources with Checkout disabled. User confirmed no live key has been created and requires sandbox acceptance first. No live-key mismatch exists. Complete the test-first checklist in HANDOVER.md before live provisioning.

Final staging repair verification: stripeWebhook redeployed successfully with the restored endpoint signing secret. A signed non-payment probe returned HTTP 200; the forged-signature probe returned HTTP 400. Probe ID: evt_audit_signature_1790558561321. Both staging and production now pass the corrected Stripe resource verifier in test mode. This does not constitute live-payment verification.

## A4 staging Upgrade repair (September 27, 2026)

User confirmed the test environment, Products and enabled staging webhook, then reported createCheckoutSession HTTP 400 and service-worker caching of Firestore streams. Deployed staging CHECKOUT_ENABLED was false. Verified the staging test Stripe configuration, set only staging Checkout to true and deployed createCheckoutSession. Production was checked separately and remains false.

Fixed public/sw.js: v3 caches discard old app v2 caches, external/API requests bypass service-worker caching, only static app assets are cache-first, billing-return pages are not saved, and navigations can fall back to the app shell on network/server failure. Improved billing's generic transport/server error text so it no longer incorrectly diagnoses every internal error as offline. Deployed the frontend only to hosting:staging in goal-calendly-staging.

Evidence: service-worker regression script passed; staging build and public deployment smoke checks passed; fresh non-admin signup and browser Upgrade returned HTTP 200 and reached a cs_test_ Stripe Sandbox checkout displaying Pro $4.99/month. Browser cache inspection found v3 app-origin caches only and no v2 caches. Offline /subscription reload returned the app shell. No card was submitted and no entitlement-upgrade claim is made. Unpaid test sessions/accounts were created by the browser checks. User can now retry A4 after reopening/reloading staging; full payment and Portal/lifecycle acceptance remain pending.

## Sharing repair and payment update (September 27, 2026)

User reports that the hosted sandbox payment now worked. This is recorded as user-confirmed payment completion; independent verification of that account's paid entitlement, ads, limits, and remaining Portal/lifecycle scenarios is still pending.

Fixed sharing failures caused by optional undefined fields in loaded goals: shared goals now use the existing JSON export representation before Firestore writes, preserving timestamps on the enclosing share document. ShareDialog catches failed writes, offers Retry/Close, and uses one share ID and a stable snapshot. Share is disabled when no goals have loaded, preventing empty snapshots during startup.

The browser regression also found that loadFromFirestore filtered on legacy type='goal', which current backend writes omit. Removed that filter while retaining the owner UID filter; maintained updatedAt ordering locally. Existing data is not modified or deleted.

Validation: serialization regression passed (nested optional fields, false/zero values, history, and immutable input); staging build passed; deployed hosting:staging. A fresh ordinary account created a goal, reloaded, generated a share link/QR, and downloaded the correct goal through Firestore at 1280px and 390px viewport widths with no uncaught browser errors. Phone-width browser verification is not a physical-phone test. Latest staging bundle: index-VnvZ9aDf.js. These frontend fixes are deployed to staging only.

## Automatic saving and restored Save button (September 27, 2026)

User confirmed automatic saving is required and asked about the missing ordinary-user Save button. Restored Save in the Goals toolbar for all accounts as an explicit backup through the protected update callable. Autosave remains enabled. Manual snapshots omit undefined fields and do not write identity or completion/reopening fields, preserving separate quota commands. Updates to the same goal are queued in order; manual snapshots are enqueued immediately so later edits follow them. Timer start/stop save failures now appear in the visible error banner instead of being silently ignored. Timer progress saves on Stop, not on every tick; Save does not stop or checkpoint a running timer.

Validated the ordered-save/manual-save regression script, staging build, and ordinary-account browser flow: note autosave persisted through reload without Save; clicking Save after another edit displayed Goals saved and the new note survived reload. Save is visible at phone width. Deployed only hosting:staging; production remains unchanged. Latest staging bundle index-B-uwoVv4.js.

## Same-period upgrade and goal loading repair (September 27, 2026)

Confirmed the reported user's Stripe test subscription is active on Platinum ($9.99/month), while the app billing projection was Pro. The sync function incorrectly skipped changes when subscription ID, status, and billing-period end were unchanged. Removed that shortcut and added an older-event timestamp guard. Same-second event ordering remains dependent on reconciliation; timestamps are not unique Stripe object versions.

Resynced the account from its actual Stripe test subscription: entitlement now Platinum, 30 active goals, no ads. Both existing goal documents (work and Ai development) were compared before/after and are unchanged. No goals were deleted or recreated. The original missing-screen report was not conclusively reproduced; a browser regression did expose an initial-load/creation race, now prevented by waiting for hydration before rendering editing routes. Loading failures now display Retry instead of silently returning an empty array.

Paid users now see Change in billing, which opens the Portal directly. Portal return displays Back from billing and the verified plan rather than an unverified success claim. Deployed staging hosting plus stripeWebhook, reconcileOneCustomer, and reconcileSubscriptionsScheduled; production and live payments unchanged.

Validation: functions build and staging frontend build passed; full emulator suite 45/45, including same-period upgrade and cancellation changes. Browser test with a synthetic paid fixture passed: Platinum display, no Upgrade button, Portal request instead of Checkout, and goal persistence across reload, billing return, and logout/login. The synthetic fixture is not evidence of another real Stripe payment. Remaining lifecycle acceptance and live launch are still pending.

## Latest sandbox closure and live prerequisites

See [STAGING_ACCEPTANCE.md](./STAGING_ACCEPTANCE.md) for the final test record: 49/49 emulator tests; actual Stripe test renewal/cancellation/recovery webhooks; simulated grace expiry; Portal payment-method and annual interval changes; paid-ad suppression; Pro/Platinum quotas; duplicate Checkout rejection. Fixed unpaid-period projection and grace-restart defects and deployed them to staging. Prior broad pending lists are superseded for those individual checks.

Public Contact us destination is now ezboss.business@gmail.com. Owner confirmed live Stripe business/bank setup has NOT been completed. Steps 11-12 remain open for that private setup, live credentials/resources, production backup/cutover, authorized real purchase, and initial monitoring. Read the acceptance record's release-review limits before claiming the entire original specification is accepted.

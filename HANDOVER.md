# Handover: Goal Calendly subscriptions and billing

Step 12 deliverable. Written September 27, 2026, while step 11 (live Stripe cutover and first real purchase) is still awaiting verified live configuration. This document collects what already exists across the repo into one operator-facing reference and states plainly what remains before step 12 can be marked complete. See [admin_subscriptions.md](./admin_subscriptions.md) for the full plan and roadmap this executes.

## What is live right now (2026-09-27)

- **Production** (`goal-calendly`): frontend at `https://goal-calendly.web.app`, 17 Cloud Functions after this audit deployed the missing maintenance callable, Firestore rules/indexes deployed. `CHECKOUT_ENABLED=false` — no live purchases possible yet. 2 real users, both migrated (usage/entitlement docs backfilled).
- **Staging** (`goal-calendly-staging`): fully deployed mirror used for rehearsal (step 10). Points at the same Stripe **test-mode** account as production currently does.
- **Health check run for this handover**: frontend build clean, functions build clean (`tsc`), all 17 production functions listed as deployed and running (`nodejs20`), hourly `reconcileSubscriptionsScheduled` firing on schedule with zero errors and "0 record(s) processed" (expected — no live billing customers exist yet).
- Full environment detail, exact deploy commands, and every issue hit while standing these up: [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md).

## Resource inventory

| Resource | Status | Where recorded |
| --- | --- | --- |
| Stripe test Products/Prices (Pro, Platinum, monthly/annual) | Created, verified, idempotent | `credentials.md` handoff table, `config/stripe-resources.test.json` (gitignored) |
| Stripe test Portal configuration | Created, verified | Same as above |
| Stripe test webhook endpoints (staging + production) | Registered, separate signing secrets, delivery verified | [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) |
| Stripe live Products/Prices/Portal/webhook | Intentionally deferred until sandbox acceptance | No live key created; user confirmed test-first sequence |
| Firebase projects (local/staging/production) | All three exist and are configured | [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) |
| Firestore rules/indexes | Deployed to staging and production | Same |

## Migration results

- Dry-run and apply rehearsed against real staging fixtures and a real dry-run against production: legacy Free/paid/current users all classified correctly, re-running produces no duplicate grants (`DEPLOYMENT_RUNBOOK.md` migration section).
- Production's 2 real users were migrated live during step 10 after a real bug was found and fixed (new signups weren't getting entitlement docs at all — see step 10 in the progress log of `admin_subscriptions.md`).
- No `--apply` has been run against production for a *legacy paid plan* migration, because production currently has none needing it. The `--apply` step for the live cutover itself is step 11's job, during the actual maintenance window.

## Test evidence

- Entitlement tests: `npm run functions:test` from the repository root (17 passing in this audit (14 entitlement + 3 configuration tests)). Integration tests: `firebase emulators:exec --only "functions,firestore,auth" --project demo-goalcalendly "npm run test:emulator-suite"` from the repository root. Earlier evidence is in the progress log; fresh results are recorded below.
- Live-driven (not just code-read) verification: Playwright sessions against deployed staging for signup→entitlement, ad rendering, payment-issue banners, old-client-refresh rejection, and concurrent-edit merging (`DEPLOYMENT_RUNBOOK.md`, "Old-client and concurrency drills" and "Advertising and offline rehearsal" sections).
- Reconciliation alerting confirmed with a real fired email alert against a deliberately broken record on staging.

## Deployment details

Exact commands, project IDs, secret-binding steps, and every real snag encountered (Blaze-plan propagation delay, per-project Secret Manager, manual Authentication provider enablement, container cleanup policy) are in [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) — written so a new environment can be reproduced from it without re-discovering those snags.

## Support and rollback

- **Disable new purchases without touching anything else**: flip `CHECKOUT_ENABLED=false` on the backend (already the default in production). Webhooks, Manage billing, and reconciliation keep running.
- **Per-customer repair**: `reconcileOneCustomer` callable (admin-only) re-syncs one UID/customer against current Stripe state — use for "charged but not upgraded" or similar support cases.
- **Goal-write pause**: `systemFlags/goalWritesPaused` blocks all goal mutations (including non-quota ones) — used during the counter-migration maintenance window; verified live on staging via real authenticated HTTP calls.
- **Rollback**: revert to a frontend/backend version compatible with the current protected data model; never restore owner-writable billing fields or reopen direct goal writes. A code rollback does not undo Stripe charges — those are handled through Stripe support workflow, not code. Full procedure and a physically-rehearsed drill: `DEPLOYMENT_RUNBOOK.md`.
- **Refund vs. cancellation**: these are explicitly different operations in Stripe and must be resolved as different support cases — see section 9 of `admin_subscriptions.md`.

## Known non-blocking follow-up items (need an owner)

| Item | Risk if ignored | Owner |
| --- | --- | --- |
| Node 20 Cloud Functions runtime decommissions 2026-10-30 | Deploys stop working entirely after that date | Needs a dedicated upgrade change (breaking changes expected in `firebase-functions`), separate from any billing deploy |
| Undocumented second frontend `https://goalcalendly.netlify.app` pointed at the same production Firebase project | Confusing/stale UI could be shown to some users if it's ever linked to; not synced by this repo's deploys | User confirmed it's a leftover test deploy — decide whether to take it down or bring it under deploy management |
| Enterprise contact address is a placeholder (`sales@goalcalendly.example`) | Real Enterprise leads currently have nowhere real to go | User needs to supply a real contact address/form |
| Frontend main JS chunk is 806 kB (243 kB gzipped) | Not a billing risk; slower initial load | Optional: code-splitting, not part of this plan's scope |

## Explicitly not delivered (do not advertise as shipped)

Per section 2 and step 8 of `admin_subscriptions.md`, these labels were removed from user-facing copy because no implementation backs them: advanced analytics, reminders, team collaboration, third-party integrations, and any SLA/guaranteed response time. Any future work on these is a separate, unscoped enhancement — not part of the subscriptions/billing delivery.

## Final delivery checklist (section 9 of the plan)

- [x] Billing code and server authorization implemented and tested.
- [x] Application behavior matches section 7 and the selected pricing ($4.99/$9.99).
- [x] Test Stripe resources created, verified, and inventoried.
- [ ] Live Stripe resources verified and inventoried: intentionally deferred until sandbox testing passes; no live key is needed for testing.
- [x] Legacy profiles/goals migrated without data loss (rehearsed on staging; production's real users already migrated).
- [x] Frontend, backend, rules, and indexes deployed to production (with Checkout still disabled).
- [ ] Checkout, webhook synchronization, Portal, ads, and goal limits verified after deployment **with live payments** — verified in test mode only so far; live verification is step 11's completion check (a real purchase).
- [x] Monitoring, reconciliation, rollback, and operator documentation delivered — this document plus `DEPLOYMENT_RUNBOOK.md`.

## What step 12 still needs once step 11 unblocks

- Watch error rates and Stripe/entitlement sync closely during the first live release window (this document's monitoring section is ready; nothing to build).
- Record subsequent real lifecycle events as operational follow-up. Future monthly/annual renewals are not a prerequisite for handover; validate lifecycle paths in staging, then monitor real events as they occur.
- Close live resource verification, the authorized live purchase check, and initial release monitoring with dated evidence.

Until then, step 12 is **prepared but not complete** — full sandbox acceptance still needs evidence; live activation and monitoring follow only after testing is complete.

## Fresh audit evidence (September 27, 2026)

- Builds: frontend and Functions passed. Unit/config tests: 17 passed. Emulator suite: 44 passed, zero failures. Initial startup timeout and mismatched test fixture were diagnosed and corrected; the final run passed. Set `$env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'` before starting emulators on this machine.
- Public deployment checks passed for production and staging: home, login, subscription and billing-return routes, matching Firebase project in each bundle, and no private Stripe-key pattern in the bundle. These are smoke checks, not proof of a purchase.
- Production maintenance callable `setGoalWritesPaused` deployed successfully. It was absent from the earlier 16-function inventory; production now has 17 functions. The write-pause flag was not changed.
- Stripe resources currently verify in TEST mode, intentionally. User confirmed no live key has been created. CHECKOUT_ENABLED remains false; finish sandbox acceptance first.
- Exact production test webhook: `https://stripewebhook-wpkahzvajq-uc.a.run.app`, ID `we_1UK6cJ33BJJtidgHVWxoiJD8`.
- Restored missing staging test destination: `https://stripewebhook-secrj7wtva-uc.a.run.app`, ID `we_1UKTEb33BJJtidgHg1YTcdfq`; its endpoint secret is saved to staging Secret Manager. Both endpoints use API version `2026-08-26.dahlia`.
- Future renewals are monitoring follow-up, not a reason to delay handover for months. Live configuration, an authorized first real purchase, and initial release monitoring still need dated evidence.

Final staging repair verification: stripeWebhook redeployed successfully with the restored endpoint signing secret. A signed non-payment probe returned HTTP 200; the forged-signature probe returned HTTP 400. Probe ID: evt_audit_signature_1790558561321. Both staging and production now pass the corrected Stripe resource verifier in test mode. This does not constitute live-payment verification.

## Test-first acceptance gate (user clarification)

Latest user confirmation: Platinum-to-Pro downgrade worked; cancellation and downgrade controls are present inside Stripe. This confirms plan-change acceptance, not an executed cancellation. Prior broad unchecked items below combine several scenarios; completed purchase/plan-change evidence appears in the later repair notes. Remaining hosted acceptance: cancellation/access transition, payment-method update, renewal, failed-payment recovery/grace expiry, paid ad suppression/goal-limit enforcement, and duplicate-subscription prevention.

No live key is required or requested now. The 61 passing automated tests, deployed signature probes, and resource checks do not prove a completed hosted Checkout purchase. `functions/tests/checkoutEnabled.manual.mjs` creates Checkout/Portal URLs but never completes payment; it explicitly skips its active-subscriber check.

Before declaring testing complete, record sandbox-only end-to-end evidence for:

- [ ] Completed hosted test payment, real Stripe delivery, billing-return confirmation and paid entitlement on staging.
- [ ] Paid ad suppression and increased goal allowance after that payment; duplicate subscription prevention.
- [ ] Portal payment-method update, plan change and cancellation, including entitlement synchronization.
- [ ] Renewal, failed-payment recovery and grace expiry using sandbox lifecycle simulations, with outcomes recorded separately from production events.

Use test credentials and test payment methods only. Leave production Checkout disabled. Live resources, a real purchase and launch monitoring remain later release tasks; the missing live key is intentional, not a defect.

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

## Paid-plan downgrade and cancellation discoverability

Verified the staging Stripe Portal configuration permits price changes and cancellation at period end. The reported Platinum subscription is active, has no schedule, and is not already canceling. App Plan page now explicitly offers Cancel subscription in Stripe for paid subscriptions (both Pro and Platinum), opening the existing Portal for customer confirmation; it does not itself cancel. Scheduled cancellations show a management label. Added plan-change/pricing explanation. Staging frontend build and hosting deployment passed. The exact location of the user's missing button (app versus Stripe) is awaiting clarification; no Stripe-hosted UI defect has been reproduced and no customer subscription was changed.

## Latest sandbox closure and live prerequisites

See [STAGING_ACCEPTANCE.md](./STAGING_ACCEPTANCE.md) for the final test record: 49/49 emulator tests; actual Stripe test renewal/cancellation/recovery webhooks; simulated grace expiry; Portal payment-method and annual interval changes; paid-ad suppression; Pro/Platinum quotas; duplicate Checkout rejection. Fixed unpaid-period projection and grace-restart defects and deployed them to staging. Prior broad pending lists are superseded for those individual checks.

Public Contact us destination is now ezboss.business@gmail.com. Owner confirmed live Stripe business/bank setup has NOT been completed. Steps 11-12 remain open for that private setup, live credentials/resources, production backup/cutover, authorized real purchase, and initial monitoring. Read the acceptance record's release-review limits before claiming the entire original specification is accepted.

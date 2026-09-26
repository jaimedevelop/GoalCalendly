# Step 1 baseline report and decision record

Date: 2026-09-26. Produced per `admin_subscriptions.md` section 10, Step 1.

## Decisions recorded

| Decision | Value | Source |
| --- | --- | --- |
| Free tier | 2 active goals, with advertising, no card required | Fixed by section 1 (non-negotiable) |
| Pro / Platinum active-goal limits | 15 / 30 (unchanged) | README / `src/types.ts` |
| Enterprise | Unlimited, custom/contact pricing | README / `src/types.ts` |
| Launch pricing | **Not yet selected.** User has not chosen between (a) new $4.99/$9.99 monthly ($49.90/$99.90 annual) or (b) keep existing $3.50/$9.50 monthly ($35/$95 annual). Treated as open until the user decides, per section 8's requirement to select pricing before provisioning. | Section 3 pricing table / section 8 |
| Cancellation policy | Cancellation scheduled for period end; access continues through paid-through date (section 5 default) | Using document default — no change requested |
| Downgrade / over-limit policy | Non-destructive: keep existing goals usable, block new/reactivated goals until under the new limit, never auto-delete | Using document default |
| Grace period | 7-day grace period after first `past_due` following a prior successful payment; no grace on an initial failed payment | Using document default |
| Legacy manually-assigned paid plans | Migrate to explicitly marked complimentary access with documented expiry or reviewed permanent grant; never auto-charged | Using document default |
| Enterprise contact destination | **Not yet selected** — need a real contact email/form destination to wire into the Contact button | Open item |
| Admin provisioning | Firebase custom claims, provisioned by UID; hard-coded `admin@admin.com` email check removed | Section 2 / section 3 |

## Baseline inspection

### Build and lint

- `npm run build`: **passes**. Vite production build succeeds (single warning: main JS chunk is 917 kB / 235.81 kB gzipped — pre-existing, unrelated to subscriptions, noted here as a pre-existing condition and not part of this work).
- `npm run lint`: **passes**, no errors or warnings.

### Goal writes, imports, and profile updates found

- `src/services/db.ts` — direct Firestore goal reads/writes, no server-side quota enforcement.
- `src/pages/Goals.tsx` — active-goal counting logic lives client-side only.
- `src/components/NewGoalDialog.tsx` — goal creation entry point; no server-enforced limit.
- `src/components/ImportTimeDialog.tsx` — goal import entry point; no shared quota check with creation.
- `src/pages/CompletedGoals.tsx` — reactivation path; no server enforcement.
- `src/App.tsx:85` — `<SubscriptionPlan user={user} currentGoalCount={0} />`: usage is hard-coded to zero, confirmed live in code today.
- `src/services/user.ts:26-27` — new profiles set `role` from a hard-coded email check and `subscriptionPlan: 'free'` client-side; `subscriptionPlan` is also settable directly via `updateUserSubscription` (line 74) and `role` via `updateUserRole` (line 113), both callable from the client with no backend authority.

### Hard-coded `admin@admin.com` — confirmed present in 16 files

`admin_subscriptions.md`, `README.md`, `ADMIN_SETUP.md`, `ADVERTISING_SETUP_GUIDE.md`, `firestore.rules` (×2 rules), `src/App.tsx`, `src/services/user.ts` (×2), `src/pages/Goals.tsx`, `src/components/AdvertisingManager.tsx`, `src/components/NewGoalDialog.tsx`, `src/components/AdminDashboard.tsx`, `src/components/SubscriptionPlan.tsx`, `src/components/Header.tsx`, `src/scripts/setupAdvertisingDemo.js`/`.ts`, `src/scripts/cleanupLegacyGoals.ts`.

### `firestore.rules` — confirmed gaps

- `match /users/{userId}`: `allow read, write` if the request is authenticated as that same UID — **the owner can write their entire profile document**, including `role` and `subscriptionPlan`. No field-level restriction exists.
- `match /goals/{goalId}`: owner has full read/write; no quota/count enforcement possible at the rules layer (expected — quota needs a transaction, planned for step 4).
- `campaigns` / `advertisingWays` writes gated on `request.auth.token.email == 'admin@admin.com'` — matches the hard-coded email problem above; this is a custom-token check, not a role or custom claim.
- No `billingCustomers`, `entitlements`, `usage`, `stripeEvents`, or `adminAuditLogs` collections/rules exist yet (expected — planned for step 3).

### Advertising

- `AdvertisingManager.tsx`, `AdvertisingDisplay.tsx`, `NewGoalDialog.tsx`, and campaign data services exist and appear functional as UI/admin tooling, but eligibility is not yet derived from a server-verified effective plan (depends on step 3's entitlement calculation).

### Deployment / environment

- No Stripe SDK dependency in `package.json` (confirmed: dependencies list has no `stripe` package).
- No `functions/` directory, `firebase.json`, or `.firebaserc` exists yet.
- No `.env.example` present in repo root at this time (to be created per section 4).
- Existing deployment host, live Firebase project contents, and whether real users currently exist were **not inspected** — this requires the user, per `credentials.md` step 2 ("write down the Project ID... tell the developer whether this project already contains real users"). **Open dependency, blocking nothing locally.**

## Open items blocking later (non-local) steps

1. Launch pricing selection (blocks step 5 resource creation, not local step 2-4 work).
2. Enterprise contact destination (blocks step 8 UI wiring only).
3. Staging Firebase project ID/config, per `credentials.md` step 2 (blocks step 2's "environment templates" only insofar as real values are needed for deployment; local `functions/` scaffolding does not require it).
4. Stripe sandbox credentials, Price IDs, webhook secret — expected later per `credentials.md` steps 4-6, tied to roadmap steps 5-7.

None of these block starting Step 2 (backend foundation) or Step 3 (entitlement types/rules) locally.

## Completion check

Per section 10: "one consistent product policy and a baseline report exist. Unavailable account configuration is explicitly listed; local implementation can continue where it is independent of that configuration." **Met**, with two policy items (pricing, Enterprise contact) still open and explicitly flagged above rather than assumed.

**Step 1 status: complete**, pending the two open policy decisions being resolved before they are needed (step 5 and step 8 respectively).

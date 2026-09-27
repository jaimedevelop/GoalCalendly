# Admin and Subscription Setup Guide

This guide covers admin provisioning and subscription/billing for Goal
Calendly. See `admin_subscriptions.md` for the full plan and roadmap, and
`STRIPE_SETUP.md` for Stripe-specific setup.

## Overview

- **Admin access**: granted via a Firebase Auth custom claim, never an email
  address. There is no special "admin" email — any account can be granted
  admin by a developer running a provisioning script.
- **Subscription plans**: Free, Pro, Platinum, Enterprise, defined once in
  `shared/subscriptionPlans.ts` and consumed by both the frontend and backend.
- **Entitlements**: a user's actual access (plan, goal limit, ad eligibility)
  is computed and stored server-side in `entitlements/{uid}`, never trusted
  from the client. See `functions/src/lib/entitlements.ts`.
- **Goal writes**: go through the authenticated backend function `mutateGoals`
  (`functions/src/goals/mutateGoals.ts`), which enforces the active-goal limit
  atomically. Direct client writes to the `goals` collection are denied by
  `firestore.rules`.

## Admin Account Setup

### 1. Grant the admin claim

There is no admin registration flow — grant the claim to an existing
account's Firebase UID:

```bash
# from functions/, after `npm run build`
ADMIN_ACTION_ACTOR_UID=<your-own-uid> npx tsx scripts/setAdminClaim.ts <target-uid> grant "reason"
```

This requires Application Default Credentials for the target Firebase
project (e.g. `gcloud auth application-default login`), or can be run inside
`firebase functions:shell` against the emulator. It does **not** require a
downloaded service-account key for normal use. Every grant/revoke is
recorded in `adminAuditLogs` with the actor UID, target UID, and reason.

### 2. Refresh the client

Firebase ID tokens cache custom claims for their lifetime. After granting
the claim, the affected user must sign out and back in (or the app must
force a token refresh) before `AuthUser.isTrustedAdmin` reflects it — see
`src/services/auth.ts`'s `readTrustedAdminClaim`.

### 3. Admin capabilities

Once `isTrustedAdmin` is true:

- **Admin Dashboard** (`/admin`): view all users, see aggregate goal counts,
  and issue audited complimentary-access grants.
- **Unlimited, ad-free access**: computed by `computeEffectiveEntitlement`
  with `source: 'admin'`, overriding any billing state or complimentary
  grant.
- Admin status is never derived from `role` in a user's Firestore profile —
  that field is a legacy display value only (see the Security Rules section
  below) and cannot itself grant privileges.

## Managing Individual Accounts

The Admin Dashboard's User Management tab now shows **Billed Plan** (the raw
`subscriptionPlan` field, kept for reference) separately from **Effective
Access** (the live, server-computed entitlement — plan, source, and any
expiry). All actions are audited:

- **Grant/revoke complimentary access**: use the dashboard's "Grant access"
  button, or call `grantComplimentaryAccess`/`revokeComplimentaryAccess`
  directly. Always requires a reason; never evidence of payment.
- **Deactivate/reactivate**: does not touch billing — a deactivated user's
  subscription keeps running until cancelled through the normal billing flow.
- **Delete**: refuses outright if the target has a live (active/past_due/
  trialing) subscription unless you explicitly acknowledge that deleting the
  profile will **not** cancel the Stripe subscription — that must be done
  separately (Stripe Dashboard or the billing support workflow). Billing,
  entitlement, and audit records are preserved after deletion so a
  since-deleted account's history remains reviewable.

## Migrating Legacy Data

If accounts existed before billing/entitlement tracking was added (manually
assigned paid plans, or goals created before the active-goal usage counter
existed), run the dry-run-first migration script:

```bash
# from functions/, after npm run build
tsx scripts/migrateSubscriptions.ts --env <project-id> --dry-run
```

Review the printed summary and the full JSON journal it writes, then apply:

```bash
tsx scripts/migrateSubscriptions.ts --env <project-id> --apply --expiry-days 30 --reason "legacy plan migration"
```

`--expiry-days` is required with `--apply` (use `0` for a reviewed permanent
grant) so a legacy paid plan is never silently granted for free indefinitely
by omission. The script:

1. Backfills `usage/{uid}.activeGoalCount` from actual goal documents.
2. Converts any `subscriptionPlan !== 'free'` with no real Stripe billing
   record into an explicit, audited complimentary grant — never continues
   to trust the raw field as if it were a paid subscription.
3. Backfills a missing `entitlements/{uid}` document for anyone who doesn't
   have one yet.

Safe to re-run: already-migrated users (those with a usage doc, an
entitlement doc, and — if paid — a real billing or complimentary-grant
record) are skipped, so re-running does not duplicate grants or overwrite
newer state. Verified by `functions/tests/migrateSubscriptions.test.mjs`.

## Subscription Plans

### Plan Tiers

Defined in `shared/subscriptionPlans.ts` (the single source of truth — check
that file for current values rather than trusting this table if it drifts):

| Plan | Active Goal Limit | Monthly Price | Advertising |
|------|------|------|------|
| **Free** | 2 | $0 | Yes |
| **Pro** | 15 | $4.99 | No |
| **Platinum** | 30 | $9.99 | No |
| **Enterprise** | Unlimited | Custom (contact sales) | No |

"Active" goals are those with `completed !== true`; completed goals never
count against the limit.

### Default Behavior

- **New users**: created with `role: 'user'`, `subscriptionPlan: 'free'`,
  forced server-side by `createFreeProfile` — the client cannot request a
  different starting role or plan.
- **Goal limits**: enforced atomically by the `mutateGoals` backend
  transaction on every create/import/duplicate/reopen, not just in the UI.
- **Upgrades**: real Stripe Checkout, wired up via `SubscriptionPlan.tsx` and
  `functions/src/billing/createCheckoutSession.ts`. See `STRIPE_SETUP.md`.

### Plan Management

Admins no longer edit a user's plan directly. Paid plans come from Stripe
webhooks (`functions/src/billing/syncSubscription.ts`); non-paid grants go
through the audited `grantComplimentaryAccess` callable
(`functions/src/admin/manageAccess.ts`), which is distinct from a real
subscription and is labeled as such in the UI.

## Technical Implementation

### User Profile Structure

```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';        // legacy/display only — see Security Rules
  subscriptionPlan: SubscriptionPlanId; // legacy/display only — see Security Rules
  createdAt: string;
  lastLoginAt: string;
  isActive: boolean;
}
```

The authoritative access decision is `entitlements/{uid}` (see
`src/types.ts`'s `Entitlement`), not this profile document.

### Security Rules

`firestore.rules` enforces:

- A user can read their own profile and update only allowlisted personal
  fields; `role` and `subscriptionPlan` must be unchanged on any
  client-originated write.
- Goals: owner can read their own; **all writes are denied** — they must go
  through `mutateGoals`.
- `entitlements`, `usage`, `billingSummaries`: owner-readable, never
  client-writable.
- `billingCustomers` (internal Stripe IDs): backend-only, not even readable
  by its own owner.
- Trusted admin status: `request.auth.token.admin == true` — the custom
  claim, never an email or Firestore field.

## Setup Steps

### 1. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules --project <your-project-id>
```

### 2. Grant yourself the admin claim

Follow "Admin Account Setup" above, then sign out/in and confirm the Admin
Dashboard is reachable.

### 3. Test subscription limits

1. Create a regular user account (Free, 2 active goals).
2. Create 2 goals; confirm a 3rd is rejected with a clear message.
3. Complete one goal; confirm a new one can now be created (completed goals
   don't count against the limit).
4. Run a real test-mode Checkout (see `STRIPE_SETUP.md`) and confirm the
   limit updates to 15 once the webhook processes the subscription.

### 4. Verify security

1. Confirm a regular user cannot open `/admin` or call admin-only functions.
2. Confirm a user cannot write `role`, `subscriptionPlan`, or any billing
   collection directly via the Firebase console/SDK.
3. Run the automated rules tests: `npm run test:rules` (or the full
   `npm run test:emulator-suite`).

## Troubleshooting

### Common Issues

1. **Admin Dashboard not accessible after granting the claim**
   - Confirm the grant actually completed (check `adminAuditLogs`).
   - Sign out and back in — a cached ID token won't reflect a new claim.
   - Check `AuthUser.isTrustedAdmin` in the browser console.

2. **Goal creation rejected unexpectedly**
   - Check `usage/{uid}`'s `activeGoalCount` against `entitlements/{uid}`'s
     `maxActiveGoals`.
   - Remember active count excludes completed goals.

3. **Subscription not reflecting a completed purchase**
   - Confirm the Stripe webhook actually fired (`stripeEvents` collection).
   - Run `reconcileOneCustomer` (admin-only) to force a resync for that UID.

### Debug Steps

Entitlement and usage are Firestore documents you can inspect directly in
the Firebase Console or emulator UI:

- `entitlements/{uid}` — effective plan, source, limit, ad eligibility.
- `usage/{uid}` — current active goal count.
- `billingSummaries/{uid}` — status, plan, interval, paid-through date (no
  internal Stripe IDs — those live in the backend-only `billingCustomers`).

## Development Notes

### File Structure

- `functions/src/admin/setAdminClaim.ts` / `functions/scripts/setAdminClaim.ts`: admin provisioning
- `functions/src/admin/manageAccess.ts`: profile creation, allowlisted updates, complimentary grants
- `functions/src/lib/entitlements.ts`: effective-access calculation
- `functions/src/goals/mutateGoals.ts`: server-authoritative goal writes
- `functions/src/billing/`: Checkout, Portal, webhook, sync, reconciliation
- `src/components/AdminDashboard.tsx`: admin interface
- `src/components/SubscriptionPlan.tsx`: subscription display and billing actions
- `firestore.rules`: security rules

### Future Enhancements

Tracked in `admin_subscriptions.md`'s roadmap (steps 9-12): audited account
deletion/deactivation handling, migration tooling for any legacy manually
assigned plans, staging rehearsal, and live production cutover.

## Support

For issues with admin or subscription features:

1. Check this guide and `admin_subscriptions.md` for the full design.
2. Run `npm run test:emulator-suite` to check nothing regressed.
3. Inspect the relevant Firestore documents (see Debug Steps above).
4. Check Firebase Functions logs for webhook/reconciliation errors.

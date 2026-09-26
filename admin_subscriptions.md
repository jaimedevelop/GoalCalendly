# Admin subscriptions and Stripe payments plan

Status: complete implementation and deployment plan. Updated September 26, 2026. The planned scope explicitly includes implementing billing, changing application behavior, creating Stripe resources, and deploying the finished system. This request produces the plan; the execution steps below are future work.

Credential setup companion: [credentials.md](./credentials.md) explains account setup, test credentials, live credentials, and where to store them, step by step. It is an instruction document, never a place to paste private keys.

## 1. Prompt for future implementation

Implement subscriptions for Goal Calendly using its existing React, TypeScript, Firebase Authentication, and Firestore application. Free users may have up to **2 active goals with advertising**. Preserve the README tier names and paid limits: Pro has 15 active goals, Platinum has 30, and Enterprise has unlimited goals with custom pricing. Paid users and trusted administrators are ad-free.

Connect paid subscriptions through Stripe Checkout, synchronize payment status through verified webhooks, and provide a Stripe Customer Portal for billing management. Enforce entitlements on the server, refresh them in the app, and extend the admin dashboard with billing status and audited complimentary access. Preserve existing goals and history when reducing limits. Use the pricing proposals below as planning defaults, not approved live prices. Complete the validation checklist before enabling live payments.

Carry the future implementation through backend and frontend development, Stripe test and live resource provisioning, data migration, staging verification, production deployment, monitoring, and rollback preparation. Deliver a working deployed subscription system, along with resource IDs and release evidence. Sections 6-9 define these work packages explicitly.

## 2. Context: what already exists

The idea is **partly implemented**: tier definitions, Free-user advertising, subscription screens, and admin controls exist. A working payment integration does not appear in the reviewed repository. Deployment state and live database contents were not inspected.

| Area | Repository evidence | Remaining work |
| --- | --- | --- |
| Tiers | `README.md` and `src/types.ts`: Free 3, Pro 15, Platinum 30, Enterprise unlimited | Change Free to 2; consistently describe active goals |
| Existing prices | `src/types.ts`: Pro $3.50/month, Platinum $9.50/month, Enterprise contact pricing | Select launch prices and create matching recurring Stripe Prices |
| Signup | `src/services/user.ts` creates Free profiles | Preserve Free signup without requiring a card |
| Upgrade screen | `src/components/SubscriptionPlan.tsx` displays plans; Upgrade and Contact buttons have no action handlers | Implement checkout, billing management, and a real contact destination |
| Usage | `src/pages/Goals.tsx` checks active goals in the UI; `src/App.tsx` passes `currentGoalCount={0}` to the subscription screen | Show accurate counts and enforce limits beyond the UI |
| Advertising | `AdvertisingManager.tsx`, `AdvertisingDisplay.tsx`, `NewGoalDialog.tsx`, campaign data services, and admin advertising controls exist | Use authoritative entitlements; verify active campaigns actually display. Existing code is not proof of ad revenue or a live ad-network connection |
| Admin | Dashboard can request subscription changes through `updateUserSubscription` | Replace direct plan edits with server-authorized, audited actions |
| Authorization | `firestore.rules` lets owners write their whole user profile, including role and plan; admin read checks trust that role | Lock privileged fields before billing launches. Existing cross-user admin writes are not permitted by these checked-in rules |
| Stripe | No Stripe SDK dependency, payment endpoints, or webhook implementation found | Add a trusted backend and Stripe integration |

Admin recognition is inconsistent and includes the hard-coded email `admin@admin.com`. Replace automatic admin assignment from email with server-provisioned Firebase custom claims. The current README security-rule example also differs from `firestore.rules`; update both during implementation.

Some plan feature labels promise advanced analytics, reminders, team collaboration, integrations, and an SLA. These labels alone do not establish that those features work or are tier-enforced. Audit them before using them as paid benefits.

### Pricing ideas

These are proposed USD price experiments, not competitor benchmarks or revenue forecasts. Annual prices below equal ten monthly payments, approximately 16.7% less than paying monthly for a year.

| Plan | Active goals | Advertising | Suggested monthly | Suggested annual | Positioning |
| --- | ---: | --- | ---: | ---: | --- |
| Free | 2 | Yes | $0 | $0 | Try the full basic tracking, timer, and progress experience |
| Pro | 15 | None | $4.99 | $49.90 | Main personal plan: more goals and no ads |
| Platinum | 30 | None | $9.99 | $99.90 | Power users; include premium reporting/support only when available |
| Enterprise | Unlimited | None | Custom quote | Custom quote | Keep contact pricing; scope support and any organization features before quoting |

Alternative launch offer: retain the existing $3.50 Pro and $9.50 Platinum monthly prices, with $35 and $95 annual options. This minimizes changes to current advertised prices. The $4.99/$9.99 option creates a clearer roughly two-to-one price step. Measure conversion, cancellations, support costs, and actual payment costs before settling on either option. Avoid adding more tiers initially.

Offer annual billing as an optional discount; clearly display the total charged each year. Free access already serves as a product trial, so a separate paid trial is not needed for the first release. Keep Enterprise sales-led until its extra value is defined. Do not promise team features or guaranteed response times solely to justify its price.

Use restrained banner/footer ads for Free users. Avoid interrupting a running timer; review the current timed modal behavior. Paid benefits should remain clear even when no advertising campaign is available.

### Goal-limit and transition policy

- Count active goals (`completed !== true`); completed history does not consume the limit. Apply this definition to every usage display and server check.
- Cover creation, import, shared-goal import, duplication, and reopening completed goals. Validate the resulting active count atomically, including simultaneous requests from two devices.
- Existing Free users with 3 goals keep their data and may continue tracking them, but cannot increase their active count until it is below 2. Apply the same non-destructive policy after a paid downgrade: allow existing goal edits, completion, export, and deletion; reject additions/reactivations while over the limit.
- Never delete goals automatically on cancellation or failed payment. Explain the limit and the options to complete goals or upgrade.
- Existing manually assigned paid plans are not evidence of payment. Migrate them to explicitly marked complimentary access with a documented expiry or reviewed permanent grant; never automatically charge them.

## 3. Current existing files to modify during implementation

Only this planning document is created now. The following are proposed later changes.

| Existing file | Planned change |
| --- | --- |
| `src/types.ts` | Free limit 2; shared plan catalog import; billing status and entitlement types; accurate benefit labels |
| `src/components/SubscriptionPlan.tsx` | Checkout buttons, billing interval selection, Manage billing, pending/error states, renewal/cancellation information |
| `src/pages/Landing.tsx` | Matching prices, limits, ad descriptions, and working Enterprise contact action |
| `src/App.tsx` | Actual active-goal count, billing-return route, entitlement listener, trusted admin route check |
| `src/services/auth.ts` | Read trusted admin claims and updated entitlement state |
| `src/services/user.ts` | Restrict profile edits; remove client subscription/role authority; route privileged actions through backend |
| `src/store.ts` | Reflect entitlement updates and handle server-rejected goal mutations without leaving false local success |
| `src/services/db.ts` | Route goal writes through authenticated backend commands; replace unguarded bulk saves with validated mutations |
| `src/pages/Goals.tsx` | Consistent limit messaging and validated import/create flows |
| `src/pages/CompletedGoals.tsx` | Ensure any reactivation path uses server enforcement |
| `src/components/NewGoalDialog.tsx` | Enforce entitlement-aware creation and ad display |
| `src/components/ImportTimeDialog.tsx` | Validate imported goals through the same server boundary |
| `src/components/AdvertisingManager.tsx` | Central ad eligibility from effective plan and trusted admin status |
| `src/components/AdvertisingDisplay.tsx` | Ensure ad placements respect eligibility and do not interrupt tracking |
| `src/components/AdminDashboard.tsx` | Paid vs complimentary access, billing status, effective plan, expiry, audit trail; safe handling of accounts with ongoing subscriptions |
| `src/components/Header.tsx` | Show effective plan from synchronized entitlement state |
| `firestore.rules` | Protect roles/billing/usage fields; restrict user profile updates to safe fields; deny direct goal writes after backend migration; secure billing and audit collections |
| `public/sw.js` | Exclude billing/API responses from caching; preserve timer behavior |
| `package.json`, `package-lock.json` | Add backend development/emulator/test scripts and required development dependencies |
| `.env.example` | Document public function endpoint configuration; no secret values |
| `.gitignore` | Exclude backend secrets and local credentials |
| `README.md`, `ADMIN_SETUP.md` | Correct tiers, security rules, admin provisioning, and subscription setup |
| `SECURITY_DEPLOYMENT.md`, `FIRESTORE_SETUP.md` | Backend deployment and protected data model instructions |
| `ADVERTISING_SETUP_GUIDE.md` | Free-only ad behavior and campaign validation |

## 4. New files to create during implementation

Proposed architecture: Firebase Cloud Functions alongside the existing Firebase data/auth stack. The frontend may retain its current static hosting. These paths do not exist yet and are planning targets.

| New file | Purpose |
| --- | --- |
| `shared/subscriptionPlans.ts` | Common tier IDs, goal limits, display pricing, and entitlement policy used by frontend/backend |
| `firebase.json` | Functions, Firestore rules, and emulator configuration |
| `.firebaserc` | Explicit development/production project aliases once project IDs are known |
| `functions/package.json`, `functions/package-lock.json`, `functions/tsconfig.json` | Backend build and dependencies: Firebase Admin, Firebase Functions, Stripe; generate lockfile through installation |
| `functions/.env.example` | Placeholder Price IDs, allowed frontend origin, environment settings; document secret-manager keys |
| `functions/src/index.ts` | Export callable functions, webhook, and scheduled reconciliation |
| `functions/src/lib/firebaseAdmin.ts` | Trusted Firebase initialization and claim checks |
| `functions/src/lib/stripe.ts` | Stripe client and server-only plan/interval-to-Price mapping |
| `functions/src/billing/createCheckoutSession.ts` | Authenticated subscription Checkout creation |
| `functions/src/billing/createPortalSession.ts` | Authenticated access to the user's own customer portal |
| `functions/src/billing/stripeWebhook.ts` | Verify and process Stripe events |
| `functions/src/billing/syncSubscription.ts` | Idempotent subscription-to-entitlement projection |
| `functions/src/billing/reconcileSubscriptions.ts` | Repair missed updates and expire grace periods/complimentary grants |
| `functions/src/admin/manageAccess.ts` | Authorized complimentary access and audited administrative actions |
| `functions/src/goals/mutateGoals.ts` | Transactional goal creation/import/update/completion/deletion and active-count enforcement |
| `functions/scripts/migrateSubscriptions.ts` | Dry-run-first migration of legacy plans and active-goal counters |
| `functions/scripts/setAdminClaim.ts` | Explicit trusted admin provisioning |
| `src/services/billing.ts` | Callable Checkout/Portal client |
| `src/hooks/useSubscription.ts` | Subscribe to current user's server-owned entitlement state |
| `src/pages/BillingReturn.tsx` | Success/cancel return experience that waits for verified entitlement state |
| `functions/tests/billing.test.ts` | Checkout ownership, event handling, status transitions, duplicate requests |
| `functions/tests/goalLimits.test.ts` | Concurrent mutations, import limits, over-limit legacy accounts |
| `tests/firestore.rules.test.ts` | Emulator tests for profile escalation and unauthorized billing/goal writes |
| `STRIPE_SETUP.md` | Test/live setup, webhook configuration, pricing, troubleshooting and rollout |
| `functions/scripts/provisionStripe.ts` | Idempotent provisioning of Products, Prices, and portal configuration for an explicitly selected environment |
| `functions/scripts/verifyStripeConfig.ts` | Check resource environment, currency, interval, amounts, active state, and endpoint configuration before enabling Checkout |
| `config/stripe-resources.example.json` | Non-secret resource inventory schema; actual environment inventories are generated during provisioning |
| `firestore.indexes.json` | Version-controlled indexes required by billing/admin queries |
| `netlify.toml` | Proposed frontend build and deployment configuration if Netlify is the selected host |
| `DEPLOYMENT_RUNBOOK.md` | Staging/production commands, migration sequence, release checks, and rollback procedure |
| `scripts/verify-deployment.mjs` | Post-deployment checks for frontend routes and expected environment/configuration |

## 5. Plan to create the Stripe connection for subscription payments

### Setup and checkout

1. Use Stripe Billing with hosted Checkout. Create Pro and Platinum Products, each with monthly and annual recurring Prices for the selected pricing option. Free needs no Stripe subscription. Create Enterprise subscriptions only after agreeing a quote. Stripe Checkout supports subscription-mode sessions: [Checkout Sessions reference](https://docs.stripe.com/api/checkout/sessions).
2. Start in a Stripe testing environment. Store `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in backend secret management. Configure `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_PLATINUM_MONTHLY`, `STRIPE_PRICE_PLATINUM_ANNUAL`, and `APP_ORIGIN` on the backend. Never expose secrets through `VITE_*`, the bundle, or Firestore.
3. The signed-in client sends only the chosen tier and interval to a callable function. Verify Firebase authentication and account status; derive UID from authentication. Resolve a permitted Price on the server, never trust a client-supplied amount, customer ID, or return URL.
4. Persist one Stripe customer mapping per Firebase UID. Use idempotency and a per-user checkout reservation to prevent concurrent customer/session duplication. Reuse an unexpired session; send existing subscribers to billing management. Associate trusted UID metadata with the session/subscription for reconciliation. Stripe also documents [limiting customers to one subscription](https://docs.stripe.com/payments/checkout/limit-subscriptions).
5. Return the hosted Checkout URL and redirect the user. Use fixed success/cancel URLs on the allowed app origin. Success shows “Confirming your subscription” until server state updates; a redirect is never proof of payment.

### Webhooks and source of truth

Verify the Stripe signature against the exact raw request body. Persist event IDs and apply changes transactionally so retries are safe. Handle out-of-order delivery by synchronizing current Stripe subscription state with per-customer serialization/version checks; ignore stale events for replaced subscriptions. Return success after durable processing; retry transient failures. These requirements follow [Stripe webhook guidance](https://docs.stripe.com/webhooks).

Listen for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, and `invoice.payment_action_required`. If delayed payment methods are enabled, also handle Checkout asynchronous payment outcomes. Grant access from verified subscription/payment state, not the event name alone. Stripe describes these lifecycle events in [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks).

Proposed application policy:

| Verified condition | Effective access |
| --- | --- |
| Free account, no paid entitlement | Free, 2 active goals, ads |
| Active subscription with confirmed paid access | Purchased tier, no ads |
| `trialing` | Paid tier only if an explicit trial is introduced later |
| `past_due` after an earlier successful payment | Proposed 7-day grace period; payment warning and billing link; server-scheduled expiry |
| `incomplete`, `incomplete_expired`, `unpaid`, `paused`, or ended subscription | Free unless another valid grant applies; retain goal data |
| Cancellation scheduled for period end | Keep paid access through the verified paid-through date |
| Trusted admin claim | Unlimited, ad-free, no subscription required |
| Valid complimentary grant | Granted tier until expiry; label it separately from paid billing |

An initial failed payment never earns the renewal grace period. Prevent old invoice events from reviving ended subscriptions. Reconciliation must expire grace periods even if no subsequent webhook arrives.

### Firestore and backend authorization

- `billingCustomers/{uid}`: server-owned Stripe customer/subscription IDs, Price ID, status, paid-through date, cancellation flag, last synchronization time. Owner may read only fields needed for billing UI; other users cannot access it.
- `entitlements/{uid}`: server-owned effective plan, source (`free`, `stripe`, `complimentary`, `admin`), goal limit, ad eligibility, and expiry. Owner-readable, never client-writable.
- `usage/{uid}`: protected active-goal count. Update it atomically with goal mutations and read entitlements in the same transaction. Backfill existing data before enforcement.
- `stripeEvents/{eventId}`: backend-only processing/deduplication records with retry state.
- `adminAuditLogs/{id}`: backend-only append operations with actor, target, reason, before/after values, and timestamp; trusted-admin reads.
- Keep `users.subscriptionPlan` only as a protected compatibility projection if needed. Users can edit allowlisted personal fields but cannot change role, plan, account status, customer mapping, or grants. Profile creation must force safe defaults.
- Migrate all goal writes through the backend before denying browser writes. Check ownership and immutable user IDs on every command. Support idempotent offline replay and clearly report rejected changes when reconnecting; cached UI state cannot authorize extra server goals.

### Customer and admin experience

Provide Manage billing for paid subscribers, including Enterprise. Create the portal session on the backend using the authenticated user's stored customer ID. Configure payment-method updates, invoices, cancellation, and eligible plan changes. The hosted portal session is described in [Stripe's portal API](https://docs.stripe.com/api/customer_portal/sessions/create).

Proposed plan-change policy: upgrades take effect after successful payment with a displayed proration preview; downgrades and cancellations take effect at period end. Configure and test these rules explicitly, using backend scheduling where the portal does not cover the desired flow. Do not create a second subscription to switch tiers.

Show admins Stripe status, paid-through date, effective access source, and grant expiry. Complimentary access must not silently cancel billing or alter an invoice. Handle subscriptions explicitly before account deletion so a deleted profile cannot leave a hidden recurring charge. Provision admins through trusted claims, never automatic registration with a special email.

### Implementation order and validation

1. Select pricing, active-goal semantics, migration policy, contact destination, Firebase projects, and Stripe account settings. This document supplies defaults; no credentials are needed for planning.
2. Implement protected profiles, trusted admins, server goal mutations, counters, and entitlement rules with emulator tests. Dry-run and review migration totals, then coordinate migration/rule deployment so old clients cannot bypass limits or lose writes silently.
3. Implement Checkout, Portal, webhook synchronization, reconciliation, and admin audit actions in test mode.
4. Connect pricing screens, live entitlement refresh, usage counts, Free ads, and billing-return messages. Verify actual advertised premium capabilities.
5. Test successful payment, abandoned Checkout, initial failure, payment authentication, renewal failure/recovery, grace expiry, cancellation, monthly/annual changes, refunds/disputes under an explicit support policy, and duplicate/out-of-order webhooks.
6. Test unauthorized profile escalation, forged Price/customer IDs, invalid webhook signatures, another user's Portal access, two simultaneous Checkouts, and concurrent attempts to create a third Free goal. Test imports, reopening, and offline reconciliation as well as normal creation.
7. Verify users above new limits retain data; paid users see no ads; Free users see active campaigns; admins remain unlimited; billing updates appear without signing out. Check that offline timers still work and billing responses are not cached.
8. Run frontend/backend builds and focused billing/rules/goal tests. Document environment setup and rollback. Enable live resources only in the later implementation task after verifying business settings, receipts, applicable tax configuration, and cancellation behavior. Recheck SDK/API compatibility when implementing.

Completion means Free is consistently 2 active goals with advertising, paid entitlements come from verified server state, limits cannot be bypassed through direct writes, Stripe recurring payments and self-service billing work end to end, and admin access changes are auditable. The deployed outcome must also meet sections 6-9.

## 6. Implement billing: concrete deliverables

Build the backend modules listed in section 4 and connect them to the frontend. Implement these contracts:

| Operation | Input | Required result |
| --- | --- | --- |
| Create Checkout | Authenticated user; `plan: pro or platinum`; `interval: month or year`; request ID | Server-selected recurring Price, one customer mapping, idempotent session, hosted URL |
| Manage billing | Authenticated user | Portal URL for that user's stored Stripe customer; useful response if no customer exists |
| Synchronize subscription | Verified Stripe event or scheduled server reconciliation | Durable billing record and effective entitlement; no duplicate grants or stale-state reversal |
| Change access administratively | Trusted admin; target UID, grant tier, expiry, reason | Audited complimentary grant; Stripe billing remains separately visible |
| Mutate goals | Authenticated owner; mutation and request ID | Atomic ownership/limit validation, goal write, and counter update |

Use explicit error codes for unauthenticated requests, inactive accounts, invalid plans, existing subscriptions, unavailable billing, and exceeded limits. The client must preserve the user's input and display an actionable error. Rate-limit billing session creation and record correlation IDs without logging secrets or payment details.

Implement a server-owned `checkoutEnabled` switch. Turning it off stops new purchases while keeping webhook processing, existing access, reconciliation, and Manage billing operational. A frontend-only flag cannot enforce this switch.

Separate private billing records from any owner-readable billing summary: Firestore reads return whole documents, so store backend-only details in a separate document instead of relying on field-level read filtering. Record billing state, grant state, and effective access independently so cancellation and complimentary access cannot overwrite each other.

Delivery evidence: focused automated tests, emulator rule tests, successful test-mode Checkout and Portal flows, and event-to-entitlement verification for payment, cancellation, failure, and recovery. Document how to replay failed events and reconcile an individual customer.

## 7. Change application behavior: before and after

| User action or condition | Existing behavior / gap | Required new behavior |
| --- | --- | --- |
| Register | Free profile with 3-goal catalog limit | Free with 2 active goals and advertising; no card required |
| Create a third Free goal | UI currently uses a 3-goal limit | Server rejects the increase; UI explains 2-goal allowance and links to upgrade |
| Import or reopen goals | No shared server quota boundary | Apply the same quota transaction; explain rejected imports without silently dropping goals |
| Open subscription page | Usage supplied as zero | Display actual active usage and current server-owned entitlement |
| Click Upgrade | Button has no payment action | Select monthly/annual billing, show total and interval, open hosted Checkout |
| Return after payment | No billing return flow | Show pending confirmation, then paid tier and ad-free access after server synchronization |
| Abandon payment | No billing return flow | Keep current access and offer retry without claiming payment succeeded |
| Renew or fix failed payment | No automated billing lifecycle | Refresh entitlement automatically and clear payment warning when verified |
| Cancel subscription | No billing management flow | Schedule cancellation according to policy; show access end date; preserve goals afterward |
| Downgrade below current usage | Undefined | Keep existing goals usable; block increases until within the new allowance |
| Paid user opens app | Ad gating trusts profile plan | Hide all ad placements using synchronized effective access |
| Admin edits subscription | Direct Firestore plan update | Use audited server grant actions; show billed plan and effective plan separately |
| App reconnects after offline use | Local state can be stale | Reconcile pending writes, respect current server limits, and surface conflicts |

Keep the goal timer and progress history usable during billing-service outages. Do not interpret a temporary entitlement-read error as a confirmed downgrade. Show the last known state with a retry indication while server writes continue enforcing authoritative access. Advertise only features verified to exist.

Delivery evidence: review the Free, Pro, Platinum, Enterprise, admin, pending-payment, and over-limit screens; verify complete click paths on desktop and mobile, including browser back/refresh and service-worker updates.

## 8. Create Stripe resources: provisioning work package

Provision resources first in the selected Stripe testing environment and then separately in live mode. Keep environment inventories separate and validate the selected account before any mutation. Stripe documents separate test/live keys and resources in [API keys](https://docs.stripe.com/keys).

### Resource inventory

The following amounts use the recommended pricing proposal. Replace them consistently if the alternative launch prices are chosen before provisioning.

| Resource | Configuration | Inventory entry |
| --- | --- | --- |
| Pro Product | Goal Calendly Pro; metadata `plan=pro` | Pro Product ID |
| Pro monthly Price | USD 499 cents; recurring every month | `STRIPE_PRICE_PRO_MONTHLY` |
| Pro annual Price | USD 4990 cents; recurring every year | `STRIPE_PRICE_PRO_ANNUAL` |
| Platinum Product | Goal Calendly Platinum; metadata `plan=platinum` | Platinum Product ID |
| Platinum monthly Price | USD 999 cents; recurring every month | `STRIPE_PRICE_PLATINUM_MONTHLY` |
| Platinum annual Price | USD 9990 cents; recurring every year | `STRIPE_PRICE_PLATINUM_ANNUAL` |
| Customer Portal configuration | Branding, support links, invoices, payment methods, cancellation and permitted plan changes | Portal configuration ID |
| Webhook endpoint | Public HTTPS backend URL; events from section 5; pinned compatible API version | Endpoint ID and URL; secret stored separately |
| Customer | Create on first purchase for a Firebase UID | Server-only UID/customer mapping |
| Checkout Session and Subscription | Create on user purchase; quantity 1 | Session/subscription IDs in protected records |
| Enterprise Product/custom Price | Create when the first agreed Enterprise contract needs billing | Contract-specific recurring Price and subscription mapping |

Free users need no Stripe Product or Price. Do not create sample customers or subscriptions in live mode as part of bulk provisioning.

Make the provisioning script safe to rerun: look up a stable application/environment identifier, reuse resources only when their configuration matches, and fail on ambiguous matches. Record created/reused IDs in a non-secret environment inventory. Price changes require a new Price and an explicit existing-subscriber policy; preserve old IDs while subscriptions reference them. See [Stripe product and price management](https://docs.stripe.com/products-prices/manage-prices).

### Provisioning sequence

1. Record selected Stripe account, testing environment, prices, currency, business/support details, and cancellation policy. Verify live account readiness before the production phase.
2. Create/reuse Products and recurring Prices. Verify amounts, intervals, currency, and active status against the application catalog.
3. Configure the portal, branding, receipts, payment methods, recovery settings, and customer-facing support links. Decide applicable tax handling before checkout is enabled; show whether displayed prices include or exclude tax.
4. Deploy a webhook handler that rejects requests until its signing secret is configured. Register its HTTPS endpoint, capture the endpoint-specific secret in secret management, bind it to the handler, and redeploy. Do not reuse the local CLI signing secret for a deployed endpoint.
5. Configure backend Price and Portal IDs, allowed frontend origin, and keys for the same environment. Run the configuration verifier and a test-mode end-to-end subscription.
6. Repeat provisioning for live resources with live IDs and keys, leaving new Checkout disabled until production verification completes.

Delivery evidence: an environment/resource inventory, successful configuration verification, a reachable signature-verifying endpoint, and working test subscriptions. Record configuration and IDs without putting secret values in documentation or source control.

## 9. Deployment: staging, production, monitoring, and rollback

### Target infrastructure and inputs

Planning default: retain the static frontend hosting approach documented in the README, using Netlify if no existing host must be preserved; deploy billing and goal APIs to Firebase Cloud Functions, with Firebase Authentication and Firestore. Confirm the actual existing host during execution rather than assuming a deployed Netlify site already exists.

Record staging and production Firebase project IDs, frontend URLs/site IDs, function region, supported Node runtime, deployment identities, Stripe account/environment, and secret names in `DEPLOYMENT_RUNBOOK.md`. Configure required cloud billing/services, service-account permissions, budget alerts, and runtime limits for the chosen backend. Pin compatible SDKs and lockfiles.

Use a dedicated staging Firebase project and Stripe test resources. Staging must never read production customer data or create live charges. Build each frontend with its own public Firebase configuration and function region/endpoint. Backend secrets remain in the corresponding cloud secret store.

### Staging release

1. Install locked frontend/backend dependencies, build both, and run billing, goal-limit, and Firestore rule tests. Ensure the shared catalog is included in the backend compilation artifact.
2. Deploy backend functions with Checkout disabled, indexes, and staging rules. Configure test Price IDs and webhook secrets using section 8.
3. Seed synthetic legacy Free/paid profiles and goals; run migration in dry-run mode, then apply it. Verify active counts and complimentary grant outcomes.
4. Deploy the frontend preview with SPA routing for `/subscription` and `/billing/return`; confirm Firebase authorized domains and allowed function origins.
5. Enable test Checkout and run the section 5 scenarios against deployed staging, including actual webhook delivery and scheduled reconciliation.

Example backend command shapes, to be run later after aliases and configuration exist:

```text
npm ci
npm --prefix functions ci
npm run build
npm --prefix functions run build
firebase deploy --only functions --project staging
firebase deploy --only firestore:rules,firestore:indexes --project staging
```

Deploy functions in explicit groups if needed, keeping the release scope reviewable. Firebase documents CLI deployment and selecting functions in [Manage functions](https://firebase.google.com/docs/functions/manage-functions). The implementation must add the referenced backend scripts; these are planned commands, not commands executed for this document.

### Production cutover

1. Record a release commit, validated build artifacts, existing backend versions/rules, and a database backup or export. Keep new Checkout disabled.
2. Deploy backend functions compatible with existing data and configure live Stripe resources. Verify environment/account consistency and signature checking before accepting purchases.
3. Protect privileged user fields immediately. Coordinate a brief goal-write maintenance window for the counter migration: deny client goal writes and pause backend goal mutations, run dry-run and apply migration, then verify counts while writes remain paused. The privileged migration uses trusted backend credentials.
4. Deploy the new frontend that uses server goal commands, deploy final rules, and require older cached clients to refresh before writes. Resume server goal mutations only after migration and rules are verified. Preserve pending local work and explain refresh/retry requirements.
5. Verify login, trusted admin access, Free limits, existing goals, billing routes, HTTPS origins, service-worker behavior, and webhook/reconciliation health on production. Confirm only the intended live Prices are selectable.
6. Enable Checkout on the backend and publish the matching pricing UI. Observe the first real authorized purchase end to end; use test mode for simulated cards and failures. Record the production release and verification results.

### Monitoring and incident response

Monitor webhook failures/backlog age, reconciliation failures, mismatches between Stripe and entitlements, Checkout errors, goal-mutation rejection rates, and function errors/latency. Alert the operator when paid access is not synchronized or events repeatedly fail. Keep logs free of secrets and card data.

Run scheduled reconciliation and provide a targeted repair command for one UID/customer. Document support steps for charged-but-not-upgraded accounts, duplicate subscriptions, cancellation disputes, and refunds. Explicitly distinguish a refund from a subscription cancellation when resolving cases.

### Rollback

- Disable new Checkout server-side first if payment or access synchronization is failing. Keep webhooks, customer billing management, and reconciliation running where healthy.
- Roll back to a frontend/backend version compatible with the protected data model. Never restore owner-writable billing fields or reopen direct goal writes to bypass the migration.
- Preserve Stripe customer/subscription mappings, events, audit records, and payment history. A code rollback does not undo charges; handle any incorrect charges explicitly through the billing support workflow.
- If migration repair is necessary, pause affected mutations, use the recorded backup and migration journal, and reconcile against current Stripe state before resuming. Do not blindly overwrite new production writes with an older export.

### Final delivery checklist

- [ ] Billing code and server authorization implemented and tested.
- [ ] Application behavior matches section 7 and the selected pricing.
- [ ] Test and live Stripe resources created, verified, and inventoried.
- [ ] Legacy profiles/goals migrated without data loss.
- [ ] Frontend, backend, rules, and indexes deployed to production.
- [ ] Checkout, webhook synchronization, Portal, ads, and goal limits verified after deployment.
- [ ] Monitoring, reconciliation, rollback, and operator documentation delivered.

The future implementation is complete only when the deployed system and these operational deliverables are verified. This revision adds their full scope to the plan.

## 10. Development roadmap: step by step

Use this section as the execution order for sections 1-9. All steps below are **not started**; documenting a step does not mark it complete. Finish each step's completion check before moving to work that depends on it. Steps 1-10 prepare and validate the system; step 11 is the production release.

### Roadmap overview

| Step | Development milestone | Depends on | Reviewable output |
| --- | --- | --- | --- |
| 1 | Confirm product rules and baseline | None | Decision record and existing-behavior inventory |
| 2 | Set up backend and environments | 1 | Buildable backend, emulator setup, environment templates |
| 3 | Secure profiles and define entitlements | 2 | Protected data model and authorization tests |
| 4 | Enforce goal limits end to end | 3 | Server goal commands and connected client flows |
| 5 | Create Stripe test resources | 2 and selected prices from 1 | Verified test resource inventory |
| 6 | Implement payment synchronization | 3, 5 | Webhook processing and reconciliation |
| 7 | Implement Checkout and billing management | 6 | Complete test purchase and Portal flows |
| 8 | Finish subscription screens and advertising | 4, 7 | Working Free/paid user experience |
| 9 | Finish admin controls and migration tooling | 3, 4, 6 | Audited access management and repeatable migration |
| 10 | Rehearse the release on staging | 8, 9 | End-to-end test results and cutover rehearsal |
| 11 | Provision live resources and deploy | 10 | Verified production release |
| 12 | Monitor and hand over operations | 11 | Release report, alerts, and support runbook |

Step 5 can be prepared once step 2 is complete while goal-limit development continues. Keep production purchases disabled until step 11. This ordering does not require multiple developers or agents.

### Step 1 - Confirm the rules and inspect the baseline

- [ ] Record the selected monthly/annual prices from section 2, with Free fixed at 2 active goals and advertising.
- [ ] Record the cancellation, downgrade, grace-period, legacy-access, and Enterprise contact decisions. Use this document's proposed defaults where no change is requested.
- [ ] Inspect the current code again before implementation; identify all goal writes, imports, profile updates, ad placements, and admin actions.
- [ ] Run the existing build and relevant checks; record pre-existing failures separately from subscription work.
- [ ] Record the existing deployment host, available environments, and missing project/account configuration without copying secrets into the document.

**Completion check:** one consistent product policy and a baseline report exist. Unavailable account configuration is explicitly listed; local implementation can continue where it is independent of that configuration.

### Step 2 - Create the backend foundation

- [ ] Follow [credentials.md](./credentials.md) steps 1-4 for project configuration and test access. Record secret locations/status only.
- [ ] Create the `functions/` project, shared plan catalog, Firebase configuration, and environment templates from section 4.
- [ ] Configure separate local/staging/production targets and secret bindings; keep Checkout disabled by default.
- [ ] Add backend build, focused test, and emulator scripts to the appropriate package files.
- [ ] Initialize the trusted Firebase client and common authentication/error handling.
- [ ] Verify that both frontend and backend can consume the same plan IDs and goal limits.

**Completion check:** frontend and backend build, emulator tests can run, and an unauthenticated request to a protected test endpoint is rejected. No payment resources are required for this check.

### Step 3 - Secure profiles and implement entitlement rules

- [ ] Create the billing, entitlement, usage, event, and audit record types described in section 5.
- [ ] Implement safe Free-profile creation and allowlisted personal profile updates.
- [ ] Replace special-email admin assignment with trusted claim provisioning and consistent authorization checks.
- [ ] Implement effective-access calculation for Free, paid, complimentary, admin, expired, and grace-period states.
- [ ] Write emulator tests proving users cannot edit their role, billing records, entitlements, or counters, or read another user's private billing data.

**Completion check:** privilege escalation tests pass and effective-access calculation is deterministic. Prepare rules locally/staging; coordinate production goal-write restrictions with the migration in step 11.

### Step 4 - Enforce the active-goal allowance

- [ ] Implement transactional server goal commands and idempotent mutation IDs.
- [ ] Connect create, edit, complete, delete, reopen, import, and shared import paths to those commands.
- [ ] Replace unguarded bulk persistence and update the local store only with a clear pending/success/failure state.
- [ ] Show accurate active-goal counts on the subscription page and goal screens.
- [ ] Implement the non-destructive over-limit policy and offline conflict/retry behavior.
- [ ] Test concurrent creation, duplicate replay, imports exceeding capacity, and existing Free users with 3 goals.

**Completion check:** a Free user can create 2 active goals, cannot add a third through any entry point, and can continue using preserved legacy goals. Pro/Platinum limits and unlimited admin/Enterprise access also pass.

### Step 5 - Provision Stripe test resources

- [ ] Implement the provisioning script and configuration verifier from section 4.
- [ ] Create test Products, monthly/annual Prices, and Portal configuration following section 8.
- [ ] Store test secrets in the correct secret store and record non-secret resource IDs in the environment inventory.
- [ ] Verify selected account/environment, amounts, currency, intervals, and allowed plans.
- [ ] Rerun provisioning to demonstrate that it reuses matching resources without duplicating them.

**Completion check:** test resource verification succeeds. If account access is unavailable, retain a clearly documented setup dependency and continue local fixture-based work; do not label provisioning complete.

### Step 6 - Implement webhooks and reconciliation

- [ ] Implement raw-body signature verification and durable event deduplication.
- [ ] Synchronize Stripe billing state into protected records and compute effective access.
- [ ] Handle retries, out-of-order events, failed payments, paid-through dates, cancellation, and expired grace periods.
- [ ] Add scheduled and per-customer reconciliation, with useful logs and failure alerts.
- [ ] Deploy the staging webhook, register its endpoint, configure its signing secret, and verify delivery using the sequence in section 8.

**Completion check:** verified test events change access correctly; forged events fail; replaying an event does not grant duplicate access; a missed event can be repaired through reconciliation.

### Step 7 - Implement Checkout and Customer Portal

- [ ] Create authenticated Checkout and Portal functions using server-resolved customer and Price IDs.
- [ ] Prevent simultaneous requests from creating duplicate customers or subscriptions.
- [ ] Implement the server Checkout switch, allowed return destinations, and request error handling.
- [ ] Add the frontend billing service and payment-return route.
- [ ] Verify a test purchase from signed-in user to paid entitlement; verify cancellation, payment-method updates, and the selected plan-change policy.

**Completion check:** payment succeeds end to end in test mode and Manage billing opens only the correct customer's Portal. A success-page visit by itself cannot activate a paid tier.

### Step 8 - Finish the customer experience

- [ ] Connect pricing cards, monthly/annual selection, Upgrade, Manage billing, and Enterprise contact actions.
- [ ] Subscribe to entitlement changes so plan labels and ads update without signing out.
- [ ] Implement pending-payment, cancellation-date, payment-warning, unavailable-service, and over-limit messages.
- [ ] Apply ad eligibility consistently, including goal dialogs and modal/banner placements; avoid interrupting timers.
- [ ] Update feature descriptions and Free limits throughout the app and documentation.
- [ ] Verify desktop/mobile flows, refresh/back navigation, and service-worker behavior.

**Completion check:** every behavior in section 7 has a verified user flow. Free users see eligible ads; paid users do not; billing operations do not disrupt goal tracking.

### Step 9 - Finish administration and migration

- [ ] Replace direct admin plan edits with audited backend grant actions.
- [ ] Display billed plan, effective plan, payment status, and complimentary expiry distinctly.
- [ ] Define and implement subscription handling for account deletion/deactivation so recurring charges remain visible and deliberate.
- [ ] Implement migration dry-run, apply, resume, and verification outputs, including legacy paid grants and goal counters.
- [ ] Test migration against representative synthetic records and repeat it to prove it does not duplicate grants or overwrite newer state.

**Completion check:** administrative actions require a trusted admin and generate an audit entry. Migration preserves all goal/history records and produces accurate counts with a recoverable journal.

### Step 10 - Rehearse on staging

- [ ] Deploy the complete staging frontend/backend/rules/indexes with test resources.
- [ ] Rehearse the write pause, migration, old-client refresh, and resume sequence from section 9.
- [ ] Run the payment, security, concurrent-goal, advertising, and offline checks in section 5.
- [ ] Verify scheduled reconciliation and an alert for a deliberately induced test failure.
- [ ] Rehearse disabling Checkout and rolling back to a compatible release without weakening rules.
- [ ] Write the deployment runbook with actual environment names, release commands, and test evidence.

**Completion check:** all required staging scenarios pass, migration and rollback are rehearsed, and no unresolved defect can mischarge a user, expose data, lose goals, or incorrectly grant/revoke paid access.

### Step 11 - Create live resources and release production

- [ ] Complete the live credential checklist in [credentials.md](./credentials.md), including separate production secrets and the production endpoint's signing secret.
- [ ] Provision and verify live Stripe resources separately from test resources.
- [ ] Record release artifacts and backup/export; keep new purchases disabled.
- [ ] Follow the production cutover sequence in section 9 for backend, protected profiles, migration, frontend, rules, and old clients.
- [ ] Verify production configuration, existing account access, goal counts, webhook signature checks, and billing routes.
- [ ] Enable Checkout only after the cutover checks pass.
- [ ] Verify the first authorized real purchase and record any follow-up issue; simulated payments remain in test mode.

**Completion check:** the production app enforces the selected tiers and a real purchase synchronizes correctly. The release record identifies the frontend/backend versions and Stripe environment used.

### Step 12 - Monitor and complete handover

- [ ] Review errors and synchronization health closely during the initial release period.
- [ ] Verify cancellation, recovery, and renewal using staging lifecycle tests and subsequent real events as they occur; distinguish simulated checks from observed production events.
- [ ] Deliver resource inventories, migration results, test evidence, deployment details, and support/rollback instructions.
- [ ] Record remaining optional enhancements separately, such as advanced reporting or team collaboration, without advertising them as delivered.
- [ ] Complete the final delivery checklist in section 9 and record any outstanding operational follow-up with an owner.

**Completion check:** the operator can diagnose billing issues, reconcile access, disable new purchases, and recover a release using the supplied documentation. Future annual renewals do not need to occur before delivery; their handling must be tested in the test environment.

### How to track progress

For each step, record its status (`not started`, `in progress`, `blocked`, or `complete`), changed files or commit, verification evidence, and next action. A blocked external configuration step does not prevent independent local work. Mark a step complete only after its completion check passes; keep this roadmap updated as implementation proceeds.

### Progress log

| Step | Status | Evidence | Next action |
| --- | --- | --- | --- |
| 1 | complete | `STEP1_BASELINE.md`: build/lint pass, baseline inventory of goal-write/admin/rules gaps recorded | Resolve open pricing and Enterprise-contact decisions before step 5/8 need them |
| 2 | complete | `functions/` project created (build/tsconfig/deps); `shared/subscriptionPlans.ts` shared catalog; `firebase.json`, `.firebaserc` (placeholder project ID), `firestore.indexes.json`; root + functions scripts (`functions:install/build/test`, `emulators`); emulator smoke test verified `ping` callable rejects an unauthenticated request (`functions/tests/ping.manual.mjs`, `npm run functions:test:manual-ping`) | Fill real staging project ID into `.firebaserc` when supplied (credentials.md step 2); proceed to step 3 (entitlement types + rules) |
| 3 | complete | Entitlement/billing/usage/audit types added (`src/types.ts`, `functions/src/lib/types.ts`); effective-access calculation `functions/src/lib/entitlements.ts` covering Free/paid/complimentary/admin/expired/grace states, 14 passing unit tests (`functions/tests/entitlements.test.ts`); server-authorized profile creation + allowlisted updates + audited complimentary grants (`functions/src/admin/manageAccess.ts`); trusted admin claim provisioning (`functions/src/admin/setAdminClaim.ts`, `functions/scripts/setAdminClaim.ts`); hard-coded `admin@admin.com` removed from all 8 app-code call sites, replaced by `AuthUser.isTrustedAdmin` read from the Firebase ID token custom claim; `firestore.rules` locked down (owner cannot write `role`/`subscriptionPlan`/`isActive`, new backend-only `billingCustomers`/`entitlements`/`usage`/`complimentaryGrants`/`stripeEvents`/`adminAuditLogs` collections); 9 passing emulator rule tests proving escalation is blocked (`tests/firestore.rules.test.mjs`, `npm run test:rules`) | No admin has been provisioned yet (needs `firebase functions:secrets`-free ADC access to run `setAdminClaim.ts` against the real project — not blocking, deferred to when an admin UID is supplied); proceed to step 4 (goal-limit enforcement) |
| 4 | complete | Transactional server goal command `functions/src/goals/mutateGoals.ts`: atomic quota check + write in one Firestore transaction, idempotent via a `goalMutationRequests/{uid_requestId}` marker (replay-safe), covers create/import/sharedImport/duplicate/reopen (quota-checked) and update/complete/delete (never blocked by the limit, per the non-destructive over-limit policy); `firestore.rules` now denies all direct client writes to `goals/*`, funneling everything through the backend; client migrated onto it end to end — `src/services/goals.ts` (typed wrapper), `src/store.ts` (optimistic local update + automatic rollback and `lastGoalError` on server rejection, no more false local success), `NewGoalDialog.tsx`/`CompletedGoals.tsx`/`GoalCard.tsx`/`Goals.tsx` all call the server path for anything that can change the active count; removed the unguarded bulk "Save" button and the client-side `saveToFirestore` bulk write path (deprecated with a warning, kept only for a still-broken legacy seeding script); active-goal count is now loaded once app-wide on sign-in (`App.tsx`) so `/subscription` shows the real count instead of the previous hard-coded `currentGoalCount={0}`; 7 passing emulator integration tests (`functions/tests/goalLimits.test.mjs`, `npm run test:goal-limits`) covering up-to-the-limit creation, two concurrent creates from simulated devices (never exceeds the limit), duplicate request replay (no double count), an over-limit import batch (rejected atomically, no partial import), a legacy 3-goal Free user over the new 2-goal limit (can edit/complete/delete, cannot add), reopen validated like create, and unauthenticated rejection; existing 9 rules tests and 14 entitlement unit tests re-verified passing after the rules/store changes | Real device/offline conflict testing needs a deployed staging environment (not blocking further local steps); proceed to step 5 (Stripe test resource provisioning) — can run in parallel with any further step 4 polish |
| 5 | complete | Live sandbox provisioning succeeded with the user's Stripe test key: created Product/Price pairs for Pro ($4.99/mo, $49.90/yr) and Platinum ($9.99/mo, $99.90/yr) and a Portal configuration (self-service plan switching between Pro/Platinum, cancel-at-period-end, payment method updates, invoice history); `npm run stripe:verify -- --env test` confirmed every Price's active state, currency, interval, and amount plus the Portal config; reran provisioning a second time and confirmed full idempotency (every resource reused, zero duplicates, identical IDs). One real bug found and fixed while actually running it: Stripe now requires an explicit `products` allowlist on `subscription_update` for the Portal config, which `provisionStripe.ts` didn't originally send — fixed to pass the Pro/Platinum product+price IDs. Non-secret IDs recorded in `credentials.md`'s handoff table and `config/stripe-resources.test.json` (gitignored). Also applied the confirmed $4.99/$9.99 pricing decision app-wide: `shared/subscriptionPlans.ts` was already correct; fixed the two remaining hard-coded/stale spots — `src/pages/Help.tsx` (was static "$3.50"/"$9.50"/"Up to 3 goals" text, now reads live from the shared catalog) and `README.md` (Free limit, all four plan prices, and the entire stale/insecure example security-rules section and admin-email instructions, which now point at the real `firestore.rules` and `setAdminClaim.ts`). `Landing.tsx`, `SubscriptionPlan.tsx`, and `AdminDashboard.tsx` already read pricing/limits dynamically from `SUBSCRIPTION_PLANS`, so they picked up the correct numbers automatically | Sandbox `STRIPE_SECRET_KEY` still needs to be bound to a deployed backend secret once a Firebase staging project exists (`credentials.md` step 7) — not blocking further local steps; proceed to step 6 (webhooks and reconciliation) |
| 6-12 | not started | — | — |

## 11. Credentials required by development stage

| Stage | Required configuration/access | Secret handling |
| --- | --- | --- |
| Local UI and emulator development | Firebase web configuration or emulator configuration; local developer tooling | No live Stripe key needed |
| Stripe integration testing | Stripe sandbox API key; test Price/Portal IDs; local webhook secret when testing event forwarding | Private keys remain in protected local/backend configuration |
| Deployed staging tests | Staging Firebase project, deployment login, frontend URL, sandbox resources, staging endpoint signing secret | Staging Google Cloud Secret Manager |
| Production deployment | Production Firebase/hosting access, live Stripe API key, live resource IDs, production webhook signing secret | Production Google Cloud Secret Manager |

Use `STRIPE_SECRET_KEY` as the configuration name for the server API credential; it may contain a restricted Stripe key with the permissions the implemented endpoints need. Prefer restricted keys. Separate runtime permissions from temporary resource-provisioning permissions and verify them during testing. Do not require account passwords, bank details, recovery codes, or unrestricted service-account JSON keys to be sent to the developer.

Firebase Cloud Functions uses its deployed service identity. A downloaded Firebase private key is not part of the normal setup. The selected frontend host receives only its public Firebase web configuration; Stripe private credentials stay on the Firebase backend. All `VITE_*` values become browser-visible.

Live credentials are required before accepting real subscription payments, not before writing or testing the application. Track provisioned secret names and successful verification without storing secret values in this file or `credentials.md`. Follow the companion guide for the order of setup, especially webhook secrets, which cannot be finalized until the endpoint exists.

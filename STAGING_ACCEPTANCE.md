# Sandbox acceptance results — September 27, 2026

Environment: goal-calendly-staging. Stripe test mode only. Separate synthetic Firebase users and Stripe Test Clocks were used; the owner's subscription/goals were not changed. No live payment was made.

## Completed checks

| Check | Evidence |
| --- | --- |
| Hosted purchase, upgrade, downgrade | Owner confirmed purchase and Platinum-to-Pro downgrade; earlier repair independently verified the Stripe subscription and app entitlement. |
| Actual webhook delivery | New test subscriptions granted Pro in deployed Firestore without manually granting paid entitlement. |
| Renewal | Stripe Test Clock advanced through renewal; paid invoice and updated billing period synchronized. |
| Cancellation | Scheduled cancellation synchronized; access stayed paid until cancellation, then Free; all 15 goal documents remained. Historical test-clock dates let the app's real clock observe an expired paid window. |
| Failed renewal and recovery | Stripe failure card produced past_due; replacing payment method and paying the invoice restored active access and cleared grace. |
| Grace expiry | Synthetic account's grace deadline moved into the past; genuine Stripe subscription update delivered to the deployed webhook revoked access. Another update did not restart grace. This is controlled deadline simulation, not seven days of elapsed production observation. |
| Scheduled grace expiry | Emulator test calls reconciliation twice; Free access and the original expired deadline persist. |
| Payment-method Portal UI | Added Visa test card ending 4242, expiring 12/2030, through Stripe Portal. Reopened Portal and confirmed it is the default. API payment-method replacement and recovery also passed. |
| Monthly-to-annual Portal UI | Confirmed Pro annual switch in Stripe; independently verified Stripe recurring interval and app billing interval both equal year. |
| Paid advertising | Signed into the genuinely billed fixture; goals rendered and configured Free ads were absent. |
| Pro quota | Server accepted 15 goals and rejected goal 16 with RESOURCE_EXHAUSTED. |
| Platinum quota | Genuine Stripe plan update synchronized; server accepted 30 total goals and rejected goal 31. |
| Duplicate purchase | Deployed Checkout callable rejected a second subscription with ALREADY_EXISTS. |
| Regression suite | 49/49 emulator tests passed; backend build passed. |

## Defects found and fixed

Stripe advances its billing period before renewal payment succeeds and can remain active while the invoice is draft. The old projection treated that new period as paid. The projection now extends paid-through only with a paid latest invoice; webhook and reconciliation fetch that invoice. Initial incomplete payment does not get a paid window.

Reconciliation retains an expired grace deadline rather than clearing it (which could restart grace), still checks Stripe for recovery, and preserves trusted-admin access when expiring grace/grants. Added regression coverage for failed initial payment, draft renewal invoices, failed renewal/expired grace/recovery, and repeated scheduled expiry.

Deployed stripeWebhook, reconcileOneCustomer, and reconcileSubscriptionsScheduled to staging. Recent frontend and contact changes are staging-only. They still need the production release in step 11.

## Remaining release work

The previously listed sandbox acceptance items above are closed. Do not interpret this as live-launch completion or a blanket claim that every scenario in the original specification has been independently exercised in a hosted browser. Payment-authentication challenge completion, refund/dispute support policy, and the proposed period-end downgrade policy need explicit release review; current Portal settings use immediate price changes with prorations, which is the behavior the owner tested.

The owner confirmed Stripe live business/bank setup is NOT complete. Public contact is ezboss.business@gmail.com. Complete Stripe.md B1 privately, then B2-B3 for secure live-key setup; never put keys in documentation or chat. Live resource provisioning, production backup/cutover, first authorized real purchase, and initial production monitoring remain steps 11-12. No Checkout activation was performed.

Evidence logs in ignored local .scratch: lifecycle-tests-final.log (49 tests), grace-deploy-final.log (backend deployment). Test accounts/clocks are isolated acceptance fixtures; Test Clocks expire automatically. Earlier failed assertions are retained separately from the final passing rerun.

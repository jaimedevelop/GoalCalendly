# Stripe setup, one small step at a time

For Goal Calendly. Updated September 27, 2026. Dashboard locations checked against Stripe's documentation.

**Do Part A now. Do Part B after sandbox testing passes. You do not need a live key to finish testing.**

“You” means the account owner. “I” means your coding assistant working in this project.

## Before you start

| Word | What it means |
| --- | --- |
| Test mode / sandbox | Practice payments; no real money moves. |
| Live mode | Real customers and real money. |
| Staging | Our practice app: https://goal-calendly-staging.web.app |
| Production | Your public app: https://goal-calendly.web.app |
| API key | A private password the backend uses to talk to Stripe. |
| Webhook | Stripe's delivery address for payment updates. |
| Signing secret | A separate password used to check those deliveries. |
| Customer Portal | The page where customers manage subscriptions. |

**Already done:** test Products, four test Prices, test Portal configuration, backend secrets, and two test webhook destinations. Your test purchase and Stripe Platinum subscription are confirmed. A same-month upgrade sync bug was fixed and your staging account was resynced to Platinum; both existing goals are intact. Automated tests pass (45 emulator tests). Remaining Portal/lifecycle scenarios still need acceptance testing before live setup.

**After the latest repair:** reopen staging and press Ctrl+Shift+R. Your account should show Platinum and both goals. To change an existing paid plan, use **Change in billing** or the billing button. Do not purchase another subscription to correct the old Pro display.

Do not recreate those resources. Never paste private keys, signing secrets, account passwords, or bank details into this file or chat. Status messages and public resource IDs are enough.

# Part A — Finish testing with pretend money

## A1. Open the existing test environment

**You do this.**

1. Open [Stripe Dashboard](https://dashboard.stripe.com/) and sign in yourself.
2. Open the account/environment selector near the top.
3. Choose the existing test environment used for Goal Calendly. Depending on your Dashboard, this appears as **Test mode**, **Sandboxes**, or a named sandbox.
4. Check that the page indicates test/sandbox before continuing.

Do not create another sandbox for this checklist. Our existing keys and Products belong to the current environment. Another sandbox has different resources. [Stripe sandbox guide](https://docs.stripe.com/sandboxes).

**Tell me:** “I am in the Goal Calendly test environment,” and its visible name if available. You do not need to send a key.

## A2. Find the existing Products

**Location:** left navigation → **Product catalog**. If missing, use Dashboard search for “Product catalog”.

1. Find Pro and Platinum. Their names may include Goal Calendly.
2. Open each Product and look at its recurring Prices.
3. Compare with this table:

| Plan | Monthly | Yearly | Active goals |
| --- | ---: | ---: | ---: |
| Pro | USD $4.99 | USD $49.90 | 15 |
| Platinum | USD $9.99 | USD $99.90 | 30 |

Yearly means that total is charged once per year. Free has 2 active goals with ads. Enterprise is sales-led.

**Do not create duplicates or change Prices.** If these are missing, tell me which environment you selected and what you see. I will check the configuration.

**Tell me:** “I can see Pro and Platinum in test mode.”

## A3. Find the staging webhook

**Location:** **Workbench → Webhooks**, or [open Webhooks](https://dashboard.stripe.com/webhooks). Recheck the selected test environment after following a link.

1. Find the destination with this address:

   ```text
   https://stripewebhook-secrj7wtva-uc.a.run.app
   ```

2. Open it. Its ID is `we_1UKTEb33BJJtidgHg1YTcdfq`.
3. Check that it is enabled. Its secret is already saved; you do not need to reveal it.

There is also a production-backend destination in TEST mode ending in `wpkahzvajq-uc.a.run.app`. That is expected during development. We use staging for this practice purchase.

**Tell me:** “The staging webhook is enabled.” If missing, tell me; I can repair the test setup without a live key.

## A4. Complete the actual test purchase

**Latest result:** You reported that the sandbox payment worked. The next billing checks are paid access/ads/limits and A5-A6. The separately reported goal-sharing failure has been repaired and verified on staging; refresh the app before retesting on desktop/phone.

**A4 readiness update (September 27):** You confirmed A1-A3. The failed Upgrade was traced to staging Checkout still being disabled. Staging test Checkout is now enabled, and a fresh non-admin browser test reached Stripe Sandbox Pro checkout at $4.99/month (HTTP 200). Production Checkout remains disabled. The staging service worker was also updated to stop caching Firestore/API traffic. Close older staging tabs, reopen the staging app, and reload before retrying A4. The payment itself has not yet been completed.

**I prepare this first:** enable Checkout on staging only and confirm the test key, Prices, and return address. Production purchases stay disabled.

**You can perform these clicks when I say staging is ready. I can also drive the browser test with available access.**

1. Open https://goal-calendly-staging.web.app.
2. Create a fresh ordinary account using an email you control. Use a different address from your admin account. Do not share its password.
3. Open the subscription/plans screen.
4. Choose **Pro**, monthly billing, then **Upgrade**.
5. Confirm Stripe's payment page says test/sandbox and shows **$4.99 per month**.
6. Enter these test details:

   | Field | Value |
   | --- | --- |
   | Card number | `4242 4242 4242 4242` |
   | Expiry | Any future date, for example `12/30` |
   | CVC | `123` |
   | Name | `Goal Calendly Test` |
   | Billing details | Valid-format test details requested by the form |

7. Submit the test payment.
8. Wait for the app to return and confirm the subscription.

Use that card only on a test payment page. [Stripe test card instructions](https://docs.stripe.com/testing).

Your admin account already has unlimited access, so it cannot demonstrate a normal paid upgrade.

**Tell me:** “Test payment submitted,” your staging account email, and any error text. Test resource IDs such as `sub_...` or `evt_...` are useful; a private billing-session link is unnecessary.

**I verify:** Stripe delivered the real test event, the correct account became Pro, ads disappeared, the allowance became 15 active goals, and another Checkout cannot create a duplicate active subscription. A success page alone is not enough.

If Upgrade is hidden, tell me. The staging switch may still be off; this does not mean you need a live key.

## A5. Try the customer billing page

**Location:** staging app → subscription screen → **Manage billing**.

Start in the app rather than opening an unrelated customer in Stripe. This proves the app opens the correct customer's Portal.

When we run this together:

1. Open Manage billing and check the subscription and invoice belong to your test account.
2. Update the payment method with a test card.
3. Try the supported Pro/Platinum or billing-interval change.
4. Return to the app so I can check its updated access.
5. Try cancellation and check the end date. Cancellation at period end should preserve access until that period ends.

We will sequence these checks so one does not invalidate the next. I will record actual behavior and fix any unsupported change flow.

**Settings location, if needed:** gear icon → search **Customer portal**. Let me check the configured `bpc_...` configuration before changing default settings; the app explicitly selects its own Portal configuration. [Stripe Portal guide](https://docs.stripe.com/customer-management/configure-portal).

## A6. Let me finish the harder tests

You do not need to wait a month or cause a real failed payment.

I will test renewals, failed payments, recovery, cancellation, and access expiry using test data. Stripe's **Billing → Subscriptions → Test clocks** area supports simulations; search “Test clocks” if hidden. These require specially prepared customers/subscriptions. I will prepare the fixtures and connect them to staging records. [Stripe subscription simulations](https://docs.stripe.com/billing/testing/test-clocks/simulate-subscriptions).

The app's seven-day grace expiry also needs its own check: advancing Stripe's clock does not automatically advance the Firebase server's clock.

**Testing is complete when I give you the completed checklist in [HANDOVER.md](./HANDOVER.md), including any unresolved issue.**

### What you can tell me now

> Keep everything in test mode. I can see the test Products and staging webhook. Prepare staging Checkout and finish the sandbox purchase, Portal, and lifecycle tests. Do not configure live payments yet.

If something is missing, tell me what you see instead. Existing test credentials already let me do most of the remaining work.

# Part B — Go live later, after testing passes

## B1. Complete your business information

**You do this privately in Stripe.**

1. Select your real business/live account in the environment selector.
2. On Dashboard home, follow any **Activate**, **Complete setup**, or verification prompt. Wording depends on the account.
3. Supply the business, representative/identity, website, and payout information Stripe requests.
4. Resolve outstanding account requirements. If Stripe is reviewing something, tell me the status.

Use real business information. Do not send me identity documents or bank details. [Stripe account setup](https://docs.stripe.com/get-started/account/set-up).

Also give me the public support/contact email and website/policy links customers should see. The app's Enterprise contact is currently a placeholder.

**Tell me:** “Business setup is complete,” or “Stripe verification is pending.”

## B2. Create a live restricted API key

**Location:** [API keys](https://dashboard.stripe.com/apikeys), or Dashboard search → “API keys”. Confirm LIVE mode.

1. Choose **Create restricted key**.
2. Name it `Goal Calendly live backend`.
3. Start with no permissions and use the table below. If asked the purpose, answer accurately; a separate assistant-operated setup key should use Stripe's agent-access option when offered.
4. Create it, complete verification, and save its value privately. It should start with `rk_live_`.

Use the permissions successfully validated in testing. Dashboard labels/groupings may differ; these resources come from our application's API calls:

| Resource | Running app | Temporary setup/verification |
| --- | --- | --- |
| Customers | Write | None |
| Checkout Sessions | Write | None |
| Subscriptions | Read | None |
| Customer Portal Sessions | Write | None |
| Customer Portal Configurations | Read | Write |
| Products | Read | Write |
| Prices | Read | Write |
| Webhook Endpoints | None | Read; Write only if I create the endpoint through the API |

Keep unrelated permissions at None. We can use a separate temporary setup key or remove temporary permissions after setup. If a request fails, send the resource/error name; do not grant everything. [Stripe restricted-key instructions](https://docs.stripe.com/keys/restricted-api-keys).

## B3. Save the live key in Firebase

**This step is outside Stripe. Do it during coordinated live setup, after I confirm cutover preparation is ready.**

1. Open PowerShell in `C:\projects AI Desktop\GoalCalendly`.
2. Run:

   ```powershell
   firebase functions:secrets:set STRIPE_SECRET_KEY --project goal-calendly
   ```

3. Paste the live key only when prompted for the secret value, then press Enter.
4. Tell me: “The live key is saved in production STRIPE_SECRET_KEY.”

Do not put the key into the command itself or replace the staging key. Saving a secret alone does not update running functions; I handle binding and deployment. If the command fails, send its error text with secrets removed. Stripe recommends protected server-side storage for private keys. [Stripe API keys](https://docs.stripe.com/keys).

## B4. Let me create the live Products and Prices

**I do this.** The provisioning script creates/reuses live Pro and Platinum Products, four recurring Prices, and the Portal configuration. I record and verify the IDs.

Review the results at **Product catalog** in LIVE mode using A2's price table. Test Price IDs cannot be used with live credentials. Do not manually duplicate Products while I provision them.

I will also plan removal/reconciliation of any test billing records in production before its backend switches to live credentials. Staging stays in test mode.

## B5. Create the LIVE webhook destination

**You can do this in the Dashboard, or I can create it with the setup key. Use one method, not both.**

In LIVE mode, open **Workbench → Webhooks → Create an event destination**. Choose your own account and API version `2026-08-26.dahlia`, matching our current code. Select:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
invoice.payment_action_required
```

Choose **Webhook endpoint** and enter:

```text
https://stripewebhook-wpkahzvajq-uc.a.run.app
```

Describe it as `Goal Calendly production LIVE` and save. If the API version is unavailable, tell me rather than choosing another at random. [Stripe webhook instructions](https://docs.stripe.com/webhooks).

Open the destination details and reveal its signing secret, starting with `whsec_`. This differs from the test destination's secret.

Save it through PowerShell:

```powershell
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project goal-calendly
```

Paste the secret at the prompt. Tell me “The live webhook secret is saved,” plus the public `we_...` destination ID.

I will disable the old TEST destination targeting production during cutover. The staging test destination remains enabled.

## B6. Let me verify and launch

**I do this:** verify live mode, Prices, Portal, events, secret bindings, database migration, existing account access, and deployment. Then enable purchases at the agreed launch point.

Switching the Dashboard to Live does not switch the app. Its backend key, resource IDs, webhook secret, deployment, and Checkout switch must agree.

Final real-payment verification uses a genuine authorized subscription purchase, not test cards or fabricated live test transactions. We will agree who is buying and the amount first. [Stripe go-live checklist](https://docs.stripe.com/get-started/checklist/go-live).

I record the purchase-to-entitlement result and initial monitoring. Any later cancellation or refund is handled explicitly; neither is automatic.

# Your short checklist

**Now:**

- [ ] Stay in the existing test environment.
- [ ] Find the existing Products and staging webhook, or tell me what is missing.
- [ ] Complete the staging test purchase when I have prepared it.
- [ ] Let me finish and document Portal/lifecycle testing.

**After testing passes:**

- [ ] Complete business verification.
- [ ] Create and securely save the live restricted key during cutover preparation.
- [ ] Let me provision and verify live Products/Prices/Portal.
- [ ] Create the live webhook once and securely save its signing secret.
- [ ] Let me deploy, verify, and coordinate launch.

**Send status and public IDs. Keep private values in Firebase Secret Manager.**

## Paid-plan downgrade and cancellation discoverability

Verified the staging Stripe Portal configuration permits price changes and cancellation at period end. The reported Platinum subscription is active, has no schedule, and is not already canceling. App Plan page now explicitly offers Cancel subscription in Stripe for paid subscriptions (both Pro and Platinum), opening the existing Portal for customer confirmation; it does not itself cancel. Scheduled cancellations show a management label. Added plan-change/pricing explanation. Staging frontend build and hosting deployment passed. The exact location of the user's missing button (app versus Stripe) is awaiting clarification; no Stripe-hosted UI defect has been reproduced and no customer subscription was changed.

## Latest sandbox closure and live prerequisites

See [STAGING_ACCEPTANCE.md](./STAGING_ACCEPTANCE.md) for the final test record: 49/49 emulator tests; actual Stripe test renewal/cancellation/recovery webhooks; simulated grace expiry; Portal payment-method and annual interval changes; paid-ad suppression; Pro/Platinum quotas; duplicate Checkout rejection. Fixed unpaid-period projection and grace-restart defects and deployed them to staging. Prior broad pending lists are superseded for those individual checks.

Public Contact us destination is now ezboss.business@gmail.com. Owner confirmed live Stripe business/bank setup has NOT been completed. Steps 11-12 remain open for that private setup, live credentials/resources, production backup/cutover, authorized real purchase, and initial monitoring. Read the acceptance record's release-review limits before claiming the entire original specification is accepted.

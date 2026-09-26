# Stripe setup: test and live provisioning

For Goal Calendly. See `admin_subscriptions.md` sections 5 and 8 for the full
plan; this file is the operational how-to for roadmap steps 5, 6, 7, and 11.

## Prerequisites

- A Stripe sandbox restricted API key, per `credentials.md` step 4. Named
  something like `Goal Calendly staging backend`, permissions scoped to the
  operations this app actually performs (Products/Prices/Portal read+write
  for provisioning; Checkout Sessions, Customers, Subscriptions for runtime).
- `functions/` built (`npm run functions:build` from the repo root).
- Pricing decided (`admin_subscriptions.md` section 3 / `STEP1_BASELINE.md`
  open item — currently defaults to the $4.99/$9.99 proposal in
  `shared/subscriptionPlans.ts`; edit that file first if a different price
  was chosen before provisioning).

## Provisioning test resources (step 5)

From `functions/`, with the sandbox key only in your shell environment for
this one command — never in a committed file:

```bash
STRIPE_SECRET_KEY=rk_test_... npm run stripe:provision -- --env test
```

This creates (or reuses, if already tagged `app=goal-calendly`) the Pro and
Platinum Products, their monthly/annual Prices, and a Customer Portal
configuration. It never touches live mode and never creates a Customer,
Checkout Session, or Subscription. The resulting non-secret IDs are written
to `config/stripe-resources.test.json` (gitignored; see
`config/stripe-resources.example.json` for the shape) and printed to the
terminal — copy the four Price IDs and the Portal configuration ID into the
non-secret handoff table in `credentials.md`.

Re-running the same command is safe: it looks resources up by tag and
reuses them instead of duplicating. If it finds an existing Price whose
amount/currency doesn't match what `shared/subscriptionPlans.ts` expects, it
refuses to guess and asks you to resolve it manually — see the "Price
changes" note in `admin_subscriptions.md` section 8.

## Verifying configuration (steps 5-7, before enabling Checkout)

Once the four Price IDs and Portal configuration ID are set in the backend
environment (`functions/.env.example` lists the variable names; actual
values go through the deploy environment, not a committed file):

```bash
STRIPE_SECRET_KEY=rk_test_... \
STRIPE_PRICE_PRO_MONTHLY=price_... STRIPE_PRICE_PRO_ANNUAL=price_... \
STRIPE_PRICE_PLATINUM_MONTHLY=price_... STRIPE_PRICE_PLATINUM_ANNUAL=price_... \
STRIPE_PORTAL_CONFIGURATION_ID=bpc_... \
npm run stripe:verify -- --env test
```

This is read-only: it checks each Price is active, has the right currency,
interval, and amount, and that the Portal configuration exists and is
active. Add `APP_ORIGIN=https://...` once a webhook endpoint is deployed
(step 6) to also verify it's registered and enabled. Exits non-zero with
every mismatch listed if anything is wrong — resolve all of them before
enabling Checkout.

## Live provisioning (step 11 only)

Repeat both commands with `--env live` and a live restricted key, only
after staging has passed the full roadmap step 10 rehearsal, and only with
new Checkout still disabled (`CHECKOUT_ENABLED=false`) until the production
cutover checks in `admin_subscriptions.md` section 9 pass. Live and test
resource IDs are entirely separate — `config/stripe-resources.live.json`
never overlaps with the test file.

## Troubleshooting

- **"does not look like a test/sandbox key, but --env test was passed"** —
  the key and `--env` flag disagree; both scripts refuse to run rather than
  risk provisioning the wrong environment.
- **"Ambiguous match: found N products tagged plan=..."** — more than one
  Product is tagged for the same plan in this Stripe account; resolve by
  hand in the Stripe Dashboard before re-running.
- **A price mismatch is reported** — either `shared/subscriptionPlans.ts`
  changed after resources were first created, or someone edited the Price
  in the Stripe Dashboard directly. Per section 8, a price change needs a
  *new* Price ID and an explicit policy for existing subscribers; don't
  edit an existing Price in place.

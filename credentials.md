# Credentials setup: a beginner's guide

For Goal Calendly. Updated September 26, 2026.

This guide tells you what to create, when to create it, and what to give the developer. You do not need to do everything today. Start with steps 1-4; the developer will supply the missing endpoint addresses later.

**Do not paste private keys into this document, GitHub, or chat.** Keep this file as instructions. Put actual secrets into the secret store described below. You can tell the developer, “The staging secret is saved,” without sending its value.

## First: a few plain-English definitions

| Word | What it means here |
| --- | --- |
| Credential | A way for a person or program to prove it is allowed to do something |
| API key | A credential used by application code |
| Public configuration | Identifiers the browser needs, such as the Firebase project ID |
| Secret | A private key that must stay out of the browser and source code |
| Sandbox / test | A practice environment for simulated payments |
| Staging | A practice copy of the app, separate from your real users |
| Production / live | The real app and real payments |
| Webhook | An address where Stripe tells our backend that a payment or subscription changed |
| Secret Manager | Google's protected storage for backend keys |

Our planned arrangement is: **DigitalOcean or Netlify hosts the website; Firebase runs login, the database, and backend functions; Stripe collects payments.** You need only one of the frontend hosting providers.

## What you need, and when

| Item | Needed when | Private? | Where it belongs |
| --- | --- | --- | --- |
| Firebase staging project ID and web configuration | Start of development | Browser-visible configuration | Local frontend `.env.local`; staging frontend host |
| Firebase production project ID and web configuration | Production preparation | Browser-visible configuration | Production frontend host |
| Google/Firebase deployment login | First backend deployment | Personal login | Your browser/CLI login; never shared passwords |
| Stripe sandbox API key | Payment development | Yes | Backend secrets; local test-only secret file if needed |
| Stripe live API key | Production payments | Yes | Production backend secrets |
| Stripe webhook signing secret | After each endpoint is created | Yes | That endpoint's backend secrets |
| Stripe Price IDs and Portal configuration ID | Checkout development / production setup | Not authentication secrets | Matching backend environment configuration |
| Frontend website URL and function region | Deployed testing | No | Environment configuration and developer handoff |
| DigitalOcean or Netlify login | Website deployment | Personal login | Provider login; repository connection |
| Stripe publishable key | Only if browser Stripe SDK is introduced | Public | Frontend configuration, if needed |

The current plan redirects to a server-created hosted Checkout URL, so it does not inherently require a Stripe publishable key in the frontend. Do not add one just because another tutorial uses it.

## Step 1 - Prepare the accounts

1. Use an email address you control for the business accounts.
2. Sign in to [Firebase Console](https://console.firebase.google.com/) using your Google account.
3. Create or sign in to your [Stripe account](https://dashboard.stripe.com/).
4. Choose your frontend host: [DigitalOcean](https://cloud.digitalocean.com/) or [Netlify](https://app.netlify.com/).
5. Enable two-step verification on these accounts and keep recovery codes in your password manager.
6. If the code is stored on GitHub, make sure you can open the correct repository.

**You are done when:** you can sign in yourself. You do not need to send anyone your passwords or recovery codes.

## Step 2 - Find the existing Firebase project, then make staging

The app already uses Firebase. Do not replace or delete its existing database while setting up payments.

1. Open Firebase Console and select the project's existing card.
2. Open the gear icon next to Project Overview, then **Project settings**.
3. Under **General**, write down the **Project ID**, not just the display name. Tell the developer whether this project already contains real users.
4. Create a separate project for practice, with a display name such as `Goal Calendly Staging`. Google may choose a longer unique project ID; copy the actual ID it assigns.
5. Inside staging, open **Authentication**, start setup if necessary, and enable the app's **Email/Password** sign-in provider.
6. Open **Firestore Database** and create the staging database if it does not exist. Let the developer confirm its region and deploy the application rules. Do not enable public database access to fix permission errors.
7. Under Project settings, register a **Web app** using the `</>` icon, or select the existing web app if one is already registered.
8. Give the app a nickname, such as `Goal Calendly Staging Web`. Copy the displayed Firebase configuration fields.

Firebase explains web app registration and the configuration object in [Add Firebase to your JavaScript project](https://firebase.google.com/docs/web/setup).

Use this mapping for the frontend:

```dotenv
# Public frontend configuration. Replace placeholders with the STAGING app values.
VITE_FIREBASE_API_KEY=REPLACE_WITH_apiKey
VITE_FIREBASE_AUTH_DOMAIN=REPLACE_WITH_authDomain
VITE_FIREBASE_PROJECT_ID=REPLACE_WITH_projectId
VITE_FIREBASE_STORAGE_BUCKET=REPLACE_WITH_storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=REPLACE_WITH_messagingSenderId
VITE_FIREBASE_APP_ID=REPLACE_WITH_appId
VITE_FIREBASE_MEASUREMENT_ID=REPLACE_WITH_measurementId_IF_PRESENT
```

For local development, the developer can place these in `.env.local`. This repository already ignores files ending in `.local`. Do not overwrite an existing local configuration without checking which project it points to. If `measurementId` is absent, tell the developer; Analytics is optional and should be guarded accordingly.

Firebase web API keys identify the project; they do not replace database rules or authentication. They are different from Firebase Admin private keys. See [Firebase API keys](https://firebase.google.com/docs/projects/api-keys).

**You are done when:** the developer has the staging public configuration, the existing project ID, and a clear label for which project contains real data.

## Step 3 - Prepare Firebase backend deployment access

1. In the staging Firebase project, review its billing plan. Deploying Cloud Functions requires the **Blaze** pay-as-you-go plan; connect a billing account when you are ready for deployed testing.
2. Set a budget alert in the linked Google Cloud billing account. An alert is a notification, not a guaranteed spending cap.
3. Have the developer install the project's Firebase CLI tooling and initialize the planned `functions/` folder and `firebase.json`.
4. When the developer runs `firebase login` on your computer, complete the Google sign-in in your browser yourself.
5. Confirm the CLI can see the staging project before deploying. The developer should explicitly select the project for every secret/deploy command.
6. For a human collaborator, use project access controls with suitable roles rather than giving them your Google password. Automated deployment identity can be configured later if needed.

The Firebase setup/deployment workflow is documented in [Get started with Cloud Functions](https://firebase.google.com/docs/functions/get-started).

**Do not download a service-account private-key JSON file for this normal setup.** Functions deployed on Firebase use a cloud service identity. If a later local migration tool requires Google authentication, the developer can configure local Application Default Credentials; that is separate from Firebase CLI login.

**You are done when:** the developer can deploy to staging using an authorized identity, and the staging project is clearly separated from production.

## Step 4 - Create the Stripe sandbox API credential

1. In Stripe, choose or create a **sandbox** for this project. Check the environment label before continuing.
2. Open **API keys** from Dashboard search or the developer tools area.
3. Create a **restricted key**, named `Goal Calendly staging backend`.
4. Ask the developer to supply the exact permission list for the implemented endpoints. Do not guess by granting every permission. Runtime access and resource-creation access can use separate credentials.
5. Save the key in your password manager until you put it into the backend secret store in step 7.
6. Tell the developer the sandbox name and that the key is ready, without sending the key in chat.

Restricted keys generally begin `rk_test_` in a sandbox and `rk_live_` in live mode. Standard secret keys begin `sk_test_` or `sk_live_`. All four are private. The planned variable name `STRIPE_SECRET_KEY` can hold the selected restricted key. Stripe recommends restricted keys and separates test/live resources. See [Stripe API keys](https://docs.stripe.com/keys).

**You are done when:** a sandbox credential exists and its permissions are documented by the developer. No live payment credential is needed yet.

## Step 5 - Get the subscription Price IDs

These are product identifiers, not passwords. The developer can create the resources using the planned provisioning script, or guide you through Stripe's Product catalog. Choose one method so resources are not duplicated.

1. Stay in the same sandbox used in step 4.
2. Confirm which pricing proposal in `admin_subscriptions.md` you want to use.
3. Create the **Pro** product with monthly and yearly recurring prices.
4. Create the **Platinum** product with monthly and yearly recurring prices.
5. Open each price and copy its `price_...` ID. A `prod_...` product ID is not the same thing.
6. Record the four IDs in the non-secret handoff table below, with a sandbox label.
7. Have the developer create/configure the Customer Portal and record its configuration ID as `STRIPE_PORTAL_CONFIGURATION_ID`.

Recommended proposal, still subject to your selection: Pro $4.99 monthly or $49.90 yearly; Platinum $9.99 monthly or $99.90 yearly. Free has no payment Price. Enterprise uses an agreed custom price later.

**You are done when:** the developer has four matching test Price IDs and the Portal configuration ID, with the amounts and billing periods verified.

## Step 6 - Get the webhook signing secret (wait for the developer's URL)

You cannot finish this step before a backend endpoint exists. That is normal.

1. Ask the developer for the exact **staging Stripe webhook HTTPS URL**. It is a backend address, not your home page.
2. In the same Stripe sandbox, open **Workbench / Webhooks** or use Dashboard search for Webhooks.
3. Add an endpoint/event destination for your account and paste the developer's URL.
4. Select the event types listed in section 5 of `admin_subscriptions.md`, using the developer's confirmed list and API version.
5. Save the endpoint, open its details, and reveal the **signing secret**, beginning `whsec_`.
6. Save it into the staging secret named `STRIPE_WEBHOOK_SECRET`, following step 7.
7. Have the developer redeploy the function with the secret bound, then verify a signed test delivery succeeds.

Every endpoint has its own signing secret. Local Stripe CLI forwarding also supplies its own secret; it must not replace the deployed staging or live endpoint's secret. See [Stripe webhooks](https://docs.stripe.com/webhooks).

**You are done when:** the staging webhook is receiving and validating Stripe events successfully.

## Step 7 - Put secrets in the backend, not the website

For this architecture, secrets belong to the Firebase backend even if the website is on DigitalOcean or Netlify.

After the developer initializes Firebase tooling, open PowerShell in the project folder. Replace `YOUR_STAGING_PROJECT_ID` with the actual staging ID. These are instructions for later execution, not commands already run:

```powershell
firebase functions:secrets:set STRIPE_SECRET_KEY --project YOUR_STAGING_PROJECT_ID
```

1. Run that command.
2. When the CLI prompts for the secret, paste your sandbox API credential there.
3. Repeat for the staging webhook secret:

```powershell
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project YOUR_STAGING_PROJECT_ID
```

4. Tell the developer both secret names are populated. Do not paste their values into the terminal command text, this document, or chat.
5. Have the developer bind the secrets to the functions that use them and deploy those functions. Saving a secret alone does not finish the integration.
6. If local emulators need test secrets, the developer may set up `functions/.secret.local`. Use only sandbox secrets there. That file is already covered by the repository's `*.local` ignore pattern.

Google documents secret creation, explicit function binding, and local secret overrides in [Configure your environment](https://firebase.google.com/docs/functions/config-env).

Put non-secret backend configuration in the appropriate environment configuration instead:

```dotenv
STRIPE_PRICE_PRO_MONTHLY=price_REPLACE
STRIPE_PRICE_PRO_ANNUAL=price_REPLACE
STRIPE_PRICE_PLATINUM_MONTHLY=price_REPLACE
STRIPE_PRICE_PLATINUM_ANNUAL=price_REPLACE
STRIPE_PORTAL_CONFIGURATION_ID=REPLACE_WITH_PORTAL_CONFIGURATION_ID
APP_ORIGIN=https://REPLACE_WITH_STAGING_WEBSITE
```

**You are done when:** the developer can verify configuration without exposing secret values, and no Stripe private key appears in any `VITE_*` variable.

## Step 8 - Prepare the website host (choose one)

You do not need a provider API token for a normal dashboard/repository-connected setup.

### Option A: DigitalOcean App Platform

1. Sign in and open **App Platform**.
2. Choose **Create App** and connect the repository containing Goal Calendly.
3. Select the intended branch. Confirm the frontend component is a **Static Site**.
4. Use `npm run build` as the build command and `dist` as the output directory.
5. Add the staging `VITE_FIREBASE_*` values as frontend build configuration.
6. Review the configuration/cost screen before creating the deployed app. Have the developer set SPA fallback routing.
7. Copy the resulting website URL and app ID for the handoff table.

See [DigitalOcean App Platform quickstart](https://docs.digitalocean.com/products/app-platform/getting-started/quickstart/).

### Option B: Netlify

1. Sign in and create/import a project from the repository.
2. Select the intended branch, build command `npm run build`, and publish directory `dist`.
3. In the project's environment variables settings, add the staging `VITE_FIREBASE_*` values for the intended deployment context.
4. Have the developer confirm SPA routing, then build/deploy the site.
5. Copy the resulting website URL and project/site ID for the handoff table.

See [Netlify build environment variables](https://docs.netlify.com/build/configure-builds/environment-variables/).

### For either host

Give the URL to the developer so they can configure the backend's `APP_ORIGIN`, Checkout/Portal return URLs, allowed origins, and Firebase Authentication authorized domains. Keep staging and production settings separate. Treat every frontend `VITE_*` value as public, even when the hosting dashboard masks its display.

**You are done when:** the deployed staging site opens, login works, and it connects to the staging Firebase project.

## Step 9 - Prepare live credentials only when staging passes

Do this with the developer during roadmap step 11, not at the start of development.

1. Complete Stripe's business activation requirements in Stripe itself. Enter business, identity, and payout information there; do not send those details to the developer.
2. Select the live Stripe environment.
3. Create a live restricted backend API credential with the tested runtime permissions.
4. Create or provision live Products, Prices, and Portal configuration. Record their live IDs separately; test IDs will not work with live credentials.
5. Confirm the real production Firebase project ID and the real website URL.
6. Store the live credential under `STRIPE_SECRET_KEY` in the **production** Firebase project's secret store. Use the step 7 command with the production project ID, never the staging ID.
7. Have the developer deploy the production webhook endpoint, then repeat step 6 of this guide in live Stripe using the production URL.
8. Store that endpoint's signing secret under `STRIPE_WEBHOOK_SECRET` in the production project.
9. Have the developer configure the live Price/Portal IDs, bind secrets, deploy, and verify environment consistency. Leave new Checkout disabled until the release checklist passes.
10. Complete the production deployment checks in `admin_subscriptions.md` before enabling purchases.

**You are done when:** live configuration is verified on production, test configuration stays on staging, and the developer has recorded verification results without recording private values.

## What to give the developer

Send public configuration/IDs and setup status. For private credentials, provide access through the authorized deployment environment or secret store, rather than a message containing the value.

Fill this table with non-secret information only:

| Item | Staging | Production |
| --- | --- | --- |
| Firebase project ID | TO FILL | TO FILL LATER |
| Firebase web app ID / public config location | TO FILL | TO FILL LATER |
| Function region (developer chooses) | TO FILL | TO FILL LATER |
| Frontend provider and app/site ID | TO FILL | TO FILL LATER |
| Frontend URL | TO FILL | TO FILL LATER |
| Stripe account ID / sandbox name | TO FILL | TO FILL LATER |
| Pro monthly Price ID | price_1UJzWf33BJJtidgHcbw8SF8v | TO FILL LATER |
| Pro annual Price ID | price_1UJzWf33BJJtidgHryhxLRyh | TO FILL LATER |
| Platinum monthly Price ID | price_1UJzWf33BJJtidgHuc1yeQZE | TO FILL LATER |
| Platinum annual Price ID | price_1UJzWg33BJJtidgHNszPa61u | TO FILL LATER |
| Portal configuration ID | bpc_1UJzXR33BJJtidgH4IFzNM68 | TO FILL LATER |
| Webhook URL / endpoint ID | WAIT FOR DEVELOPER (step 6) | WAIT FOR DEVELOPER |
| `STRIPE_SECRET_KEY` saved? | YES — sandbox key provisioned resources; not yet bound to a deployed backend secret (that happens per credentials.md step 7 once a Firebase staging project exists) | NO |
| `STRIPE_WEBHOOK_SECRET` saved? | YES / NO, no value | YES / NO, no value |
| Intended admin Firebase UID | TO FILL | TO FILL LATER |
| Public support/contact email | TO FILL | TO FILL LATER |

The developer provisions the admin claim using the intended account's Firebase UID. Choosing a special email address does not grant admin access in the planned system.

## Things you do not need to provide

- Your Google, Stripe, DigitalOcean, Netlify, or GitHub password.
- Recovery codes, bank information, or identity documents in this file or chat.
- A downloaded Firebase Admin private key for the normal deployed-functions setup.
- Both DigitalOcean and Netlify credentials; choose one frontend host.
- Live Stripe keys before local development and sandbox testing.
- A webhook signing secret before the relevant endpoint exists.

If a private key is accidentally posted publicly, rotate/revoke it in its provider and update the backend secret. Deleting the message or file alone does not invalidate the exposed key.

## Quick checklist for today

- [ ] I can sign in to Firebase and Stripe.
- [ ] I identified the existing Firebase project without changing its data.
- [ ] I created or identified a separate staging project.
- [ ] I copied the staging public web configuration.
- [ ] I selected a Stripe sandbox and know where its API keys are.
- [ ] I chose DigitalOcean or Netlify for the frontend.
- [ ] I gave the developer public IDs/status, and kept private values out of chat and Markdown.

Everything else can be completed together as the roadmap reaches the corresponding development step.

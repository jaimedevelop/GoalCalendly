# Security and deployment guide

Updated September 27, 2026. Older examples granting broad authenticated access or trusting `users.role` are obsolete. Deploy the checked-in policy and backend.

## Configuration

Firebase web configuration in `VITE_FIREBASE_*` identifies the project publicly. Authentication, Firestore rules, and backend authorization protect access. All `VITE_*` values are browser-visible.

Stripe API keys and webhook signing secrets belong in the matching Firebase project's Secret Manager. Never put them in browser configuration, Markdown, source control, or command arguments. Test/live resources must match their key. Each webhook destination has its own signing secret.

```powershell
firebase functions:secrets:set STRIPE_SECRET_KEY --project goal-calendly
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project goal-calendly
```

These commands prompt for secret input. Bind and redeploy affected functions after saving a secret; saving alone does not update deployed versions. See [credentials.md](./credentials.md).

Environment files and local secrets are ignored by Git. If a private key was exposed, revoke/rotate it first: removing a tracked file does not remove history or invalidate the credential. Public Firebase web configuration does not grant Admin SDK access.

## Authorization and release

- Deploy `firestore.rules` and `firestore.indexes.json`, not alternate permissive console examples.
- Provision admin custom claims using `functions/scripts/setAdminClaim.ts`.
- Backend callables own goal limits, billing, and entitlement changes. Client role/plan fields are not payment evidence or authority.
- Stripe webhooks verify raw-body signatures. Checkout return URLs are not payment evidence.
- Keep `CHECKOUT_ENABLED=false` until live configuration and cutover checks pass.
- Run frontend/backend builds, `npm run functions:test`, and the emulator suite in [FIRESTORE_SETUP.md](./FIRESTORE_SETUP.md).

```powershell
node scripts/verify-deployment.mjs https://goal-calendly.web.app goal-calendly
```

Use explicit Firebase projects and Hosting targets for every deployment. Follow [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) for cutover, monitoring, and rollback. Rollbacks must preserve backend-owned billing fields and deny direct goal writes. Delivery evidence and live-launch gaps are in [HANDOVER.md](./HANDOVER.md).

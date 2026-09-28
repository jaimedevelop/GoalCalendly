# Firestore setup and access troubleshooting

Updated September 27, 2026. The former open-development rules and client role examples are obsolete.

`firestore.rules` is the authoritative access policy; `firestore.indexes.json` contains the query indexes. Deploy from the repository root:

```powershell
firebase deploy --only "firestore:rules,firestore:indexes" --project goal-calendly-staging
```

Use `--project goal-calendly` for the verified production release. Never replace the maintained policy with public or authenticated-user-wide access rules.

## Current data boundary

- Owners read their goals; all goal writes go through authenticated `mutateGoals`, preserving atomic quotas and usage counters.
- Profile creation uses `createFreeProfile`. Clients cannot assign privileged profile fields.
- Admin authorization uses the Firebase Auth `admin` custom claim, not a profile role or special email.
- Entitlements, usage, billing, audit logs, and maintenance flags are backend-owned. Owners can read only the permitted projections. Internal billing customer records remain private.
- Complimentary access and account lifecycle actions use audited admin callables.

## Diagnose permission errors

1. Confirm sign-in and the intended Firebase project. Staging and production accounts are separate.
2. Refresh the ID token or sign out/in after an admin claim changes.
3. Verify goal writes call `mutateGoals`. Old clients writing directly to Firestore are intentionally rejected; refresh the installed PWA.
4. Check Functions in `us-central1`, deployed rules/indexes, and the goal-write maintenance flag.
5. A missing-index error requires the matching index, not broader permissions.
6. Use emulators for debugging. Legacy scripts that write goals or privileged profile fields directly are not a production repair path.

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
firebase emulators:exec --only "functions,firestore,auth" --project demo-goalcalendly "npm run test:emulator-suite"
```

See [ADMIN_SETUP.md](./ADMIN_SETUP.md) and [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) for claims, migration, maintenance and rollback.

# CFMS Firebase operations

The app uses the existing `attendit-350c6` Authentication project and **Realtime Database**, under `cfms/`. No Firestore is used. Payload/Figma scaffolding, managed routes, the custom image loader and unrelated AttendIt data are preserved.

## Configuration

The requested `.env` contains the supplied public Firebase web configuration and measurement ID. It is Git-ignored. The client reads `NEXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `DATABASE_URL`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID` and `MEASUREMENT_ID`, each with the full `NEXT_PUBLIC_FIREBASE_` prefix. These public identifiers are intentionally browser-visible. Changing them requires a new build. The measurement ID alone does not enable Google Analytics; study reporting uses the authenticated private pipeline below.

The supplied web configuration cannot authorize administrator operations. The Node server and trusted scripts use Firebase Admin SDK **Application Default Credentials** for the same project. Prefer an attached service/workload identity on compatible hosting. Local trusted operations can use securely provisioned ADC or `GOOGLE_APPLICATION_CREDENTIALS` pointing at a private file outside this repository. Never paste credentials into chat, source, Payload documents or `NEXT_PUBLIC_*` variables. In Make, provision third-party secrets only through the environment-variable card flow. Hosting must support these Next.js Node API routes and the trusted identity; client-only hosting is insufficient.

Local development also supports `CFMS_USE_FIREBASE_CLI=true`, explicitly enabled in this checkout. It reuses the existing Firebase CLI sign-in in memory without copying credentials. The same flag enables CLI-backed trusted import scripts. This fallback is disabled in production; production still needs an attached trusted identity.

For the standalone Vercel target, the server also accepts `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` as a private environment variable containing the complete service-account JSON for the configured project. It is never a browser variable. See [Vercel deployment](docs/VERCEL_DEPLOYMENT.md) for build settings and configuration. Make publication keeps its original managed backend configuration.

Enable Email/Password in the existing Auth project and authorize actual preview/published hostnames. Keep the supplied authDomain unchanged.

## Trust boundaries

- `/api/study/sessions` verifies token/revocation, validates every field, pins questions/settings/source version, checks revisions, assigns server time and grades saved responses. Client database writes to sessions are denied.
- `/api/study/events` verifies token and owned-session membership, bounds reading intervals, rate limits by UID, assigns UID/time and deduplicates events. Reporting failures do not fail session saves.
- `/api/study/admin` verifies `cfmsAdmin === true` on every request and returns cached summaries, paginated logs/directory and recomputed scores. Private responses are never cached publicly.
- `/api/study/account` exports the authenticated user's own study records.
- `/study-admin`, `/study-admin/students`, `/study-admin/activity`, `/study-admin/questions` are static admin shells with private API data. They avoid the template-owned `/admin` catch-all; `/admin` remains Payload.

Only trusted server code writes banks, versions, logs, summaries and sessions. Students have focused owner reads and validated profile/preferences/bookmark/recall writes. A profile role grants no privileges. Pages use noindex metadata. All client public shells continue to load live Firebase content, so a bank update does not require hardcoded question imports.

These are self-study results. Readable questions include keys; this is not proctored exam security. Flashcard ratings do not affect graded accuracy. Ambiguous keys/free-text wording stay provisional. Admin denominators exclude unresolved questions and show review counts. Legacy unversioned attempts remain provisional.

## Rules and administrator claim

`firebase.database.rules.json` is a candidate, not the deployed live rules. **Do not deploy it wholesale to this shared project.** With trusted access, run `pnpm rules:preview`. It reads current rules, refuses broad ancestor grants/root wildcards, preserves unrelated namespaces and writes private `seed-output/MERGED_RULES.json`. Test that exact merge with `CFMS_TEST_RULES_FILE` and the emulator rule suite. After review, deploy using `pnpm rules:preview -- --apply --confirm-rules <reviewed-checksum>`. It backs up live rules first.

Select the intended Auth UID explicitly:

```
pnpm admin:claim -- grant <uid> --confirm-uid <uid>
pnpm admin:claim -- revoke <uid> --confirm-uid <uid>
```

The script preserves other custom claims. Revocation revokes that Firebase account's refresh tokens and can require sign-in again in other apps sharing it. Sign out/in after claim changes. No live administrator was selected or granted access during implementation.

## Import, verification and deployment

See [the import runbook](docs/DATA_IMPORT_RUNBOOK.md), [analytics operations](docs/ADMIN_ANALYTICS.md), [privacy](docs/PRIVACY_AND_RETENTION.md) and [implementation status](docs/IMPLEMENTATION_STATUS.md).

```
pnpm install
pnpm test
pnpm typecheck
pnpm test:rules
pnpm build
figma make verify-deploy
```

The Windows-compatible script runner preserves `payload build`. Do not replace `buildFigmaConfig`, remove Payload or add dummy platform variables to bypass missing Figma identity. This local checkout lacks the environment identity and Figma CLI; production verification must run in connected Make.

Focused listeners load the latest 100 sessions initially; History loads older batches. Student statistics describe loaded history. Admin summaries are independent of that client window. All six supplied sources have now been imported: 425 original questions plus 40 clearly labeled derived study questions. Live read-back and complete HTTP workflow tests passed; their disposable account/sessions were removed. See [the source import report](docs/SOURCE_IMPORT_REPORT.md) for exact counts, review flags, import identity and the outstanding public-root-rule issue. No existing rules or administrator claims were changed.

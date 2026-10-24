# CFMS Study Hub

A financial management study system built around six PDF and Word reviewers. Students can practice, take exams, study flashcards, choose specific questions, and save their progress with Firebase Authentication and Realtime Database.

## Features

- Email/password registration, login, password reset, and student profiles.
- Practice with instant feedback, exams with results at submission, flashcards, and mixed study sessions.
- Dynamic multiple-choice, true/false, identification, enumeration, and mixed answer formats for the same source questions.
- Custom question selection with search, original question numbers, full question text, pagination, and format previews.
- Session saving and resuming, question navigation, timers, randomized order, and shuffled choices.
- Bookmarks, mistake review, session history, explanations, and progress tracking.
- Server-validated session updates and grading, with pinned question-bank versions for historical attempts.
- Administrator analytics, student activity, question insights, and CSV exports, protected by the `cfmsAdmin` custom claim at the API boundary.
- Account data export, light/dark themes, responsive layouts, and a book favicon.

Questions with usable answer keys are graded automatically, including derived study questions. Common financial-statement names and configured alternative answers are accepted. Content provenance stays in the records; it does not prevent scoring. Questions without a usable key are excluded from graded accuracy, and flashcard self-ratings do not count as graded answers. This is a self-study system: question data includes answer keys.

## Technology

| Layer | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4, Lucide icons |
| Student accounts | Firebase Authentication |
| Study data | Firebase Realtime Database under `cfms/` |
| Trusted operations | Firebase Admin SDK and Next.js Node API routes |
| Template | Payload 4 beta with Figma Make integration |
| Tests | Node.js test runner and Firebase emulators |

Study records use Firebase. The existing Payload/Figma scaffold and its `/admin` interface are separate from student accounts and the study administration screens.

## Local setup

Use the versions configured in `.mise.toml`: Node.js **24.22.1** and pnpm **10.34.3**. Run commands from the project root.

```powershell
pnpm install
```

### Firebase configuration

The current checkout already has a Git-ignored `.env`. For a fresh checkout, create `.env` using the Firebase web app configuration for the intended project:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=<web-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<auth-domain>
NEXT_PUBLIC_FIREBASE_DATABASE_URL=<realtime-database-url>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<storage-bucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<app-id>
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=<optional-measurement-id>
```

These web configuration identifiers are intentionally public. Never put service-account credentials, private keys, or access tokens in a `NEXT_PUBLIC_*` variable. Public configuration changes require restarting development or rebuilding production. The measurement ID alone does not enable Google Analytics collection.

The existing integration targets `attendit-350c6`. Enable Email/Password authentication and authorize the actual app hostnames in that project's Firebase settings. Trusted operations scripts intentionally refuse a different live project unless their project guard is explicitly adapted.

Session saves, analytics, imports, and administrator operations also need a trusted server identity. Use Application Default Credentials, preferably an attached workload identity in production. A private credential file may be referenced through `GOOGLE_APPLICATION_CREDENTIALS` outside the repository.

For local development, an existing Firebase CLI sign-in can be reused by setting:

```dotenv
CFMS_USE_FIREBASE_CLI=true
```

This checkout supports that opt-in fallback without copying CLI tokens into source. The web server disables it in production. See [Firebase operations](FIREBASE.md) for identity and access details.

### Start and stop

```powershell
pnpm dev
```

Open [localhost:3000](http://localhost:3000). `npm run dev` runs the same development script. Press **Ctrl+C** in the server terminal to stop it.

The runner uses webpack because Turbopack entered a repeated rebuild/reload loop in this Windows checkout. It respects `PORT`, defaulting to `3000`. To use another port in PowerShell:

```powershell
$env:PORT = '3001'
pnpm dev
```

If the terminal reports `EADDRINUSE`, another process is already listening on that port. Use the existing server or stop it before starting another. Check the listener with:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
```

## Studying

1. Sign in and open **Study categories**.
2. Choose **Start studying** or resume with **Continue studying**.
3. Select a study mode and answer format.
4. Choose a question count, or select **Choose questions** to search and pick exact questions. Expand a preview to see the presentation before starting.
5. Answer questions, save and exit when needed, then submit to view results and explanations.

The selected source IDs and adapted presentations stay consistent after refresh and resume. Original question numbers remain visible even when the session uses a custom subset.

Answer selections, feedback, flashcard navigation and question navigation update immediately in local state. Pending session changes are cached per account in the browser and sent through a background queue that combines rapid changes. Refresh restores pending drafts; final submission waits for cloud confirmation before opening results. Network failures show a retry action without locking ordinary study controls.

## Question catalog

The recorded live catalog contains **593 questions** across six categories. It includes the original imported questions plus clearly labeled derived study material; the totals below are not counts of originals alone.

| Category | Questions |
| --- | ---: |
| NEW REVIEWER | 84 |
| CFMS Questionnaire | 145 |
| HUHUHUHU Reviewer | 136 |
| Pre-Finals Practice & Recitation | 101 |
| Working Capital & Cash Management | 63 |
| Financial Statements Fundamentals | 64 |
| **Total** | **593** |

All 425 original questions from the five question documents were preserved. The Financial Statements PDF is a teaching reference used to prepare derived questions. See [source import findings](docs/SOURCE_IMPORT_REPORT.md), [catalog additions](docs/ALL_CATEGORY_FORMATS.md), and [dynamic formats](docs/DYNAMIC_QUESTION_FORMATS.md) for provenance, source numbering defects, review flags, and verification evidence.

### Import workflow

Imports are explicit operations; starting the app does not seed the database. Keep original documents in the Git-ignored `private-source-reviewers/` directory with filenames matching `scripts/source-manifest.json`.

Extraction uses Python with `pdfplumber` and `pypdf`. Set `CFMS_PYTHON` to the Python executable if the bundled Codex runtime is unavailable. Extraction creates private staging files and requires source review before validation can pass.

```powershell
pnpm seed:extract -- --source-dir ./private-source-reviewers
# Review the source text, highlighted keys, QA report, and staging metadata.
pnpm seed:validate
pnpm seed:preview
# Apply only the exact reviewed import ID reported by validation/preview:
pnpm seed:apply -- --confirm-import-id <reviewed-import-id>
pnpm seed:verify
```

Existing answer changes require the additional importer approval flag described in the [import runbook](docs/DATA_IMPORT_RUNBOOK.md). The pipeline validates all banks, previews differences, backs up touched data, publishes atomically, and retains version archives for saved sessions. Raw documents, staging output, and backups must stay private.

## Administration and data

Study administration starts at `/study-admin`, with student, activity, and question reports beneath it. Access requires a trusted Firebase `cfmsAdmin` claim; a profile role does not grant administrator access. Claim assignment/revocation instructions are in [FIREBASE.md](FIREBASE.md).

| Location | Purpose |
| --- | --- |
| `cfms/categories`, `cfms/questions` | Current catalog and question banks |
| `cfms/questionBankVersions`, `cfms/sourceImports` | Historical definitions and import audit |
| `cfms/users` | Student profiles, preferences, bookmarks, and sessions |
| `cfms/analytics`, `cfms/admin` | Study reporting and administration data |
| `/api/study/sessions` | Authenticated, revision-checked session saves and trusted grading |
| `/api/study/events` | Validated, deduplicated study activity |
| `/api/study/admin` | Claim-protected reports |
| `/api/study/account` | Authenticated own-data export |

Activity reporting includes approximate visible question time and session activity. The 90-day raw-event policy requires a scheduled purge job; it is not enforced merely by declaring the policy. See [analytics operations](docs/ADMIN_ANALYTICS.md) and [privacy and retention](docs/PRIVACY_AND_RETENTION.md).

## Verification

```powershell
pnpm typecheck
pnpm test
pnpm test:rules
```

The rules suite needs the Firebase Database emulator and a Java runtime supported by the installed Firebase CLI. Do not run a second emulator on an occupied port.

With reviewed private staging files available, check the imported banks with:

```powershell
node --import ./tests/register.mjs --test tests/imported-banks.integration.mjs
```

Additional server/full-system suites are in `tests/` and use the isolated `demo-cfms` Auth and Database emulators on ports `9099` and `9000`. The full-system suite also requires the reviewed banks loaded by `scripts/load-import-into-emulator.mjs`; it refuses live project settings. Live smoke scripts are separate operational tests against real Firebase and must be treated accordingly.

Recorded verification includes 40 passing unit tests, TypeScript checks, six full-system category workflows, twelve live dynamic-format/custom-selection workflows, and browser selection/save/refresh/completion checks. Evidence is in [docs/verification](docs/verification) and [implementation status](docs/IMPLEMENTATION_STATUS.md). These are recorded results, not a claim that every suite ran on the current machine today.

## Production status

The repository supports a separate Next.js + Firebase build for Vercel. See [Vercel deployment](docs/VERCEL_DEPLOYMENT.md) for the checked-in build settings and required public/server environment variables. Run `pnpm run build:vercel` to build and `pnpm run start:vercel` to test it locally. Production publication remains unverified until the deployed environment is checked.

- For Figma Make publication, build through the connected Make lifecycle using `pnpm build`, then run `figma make verify-deploy` and inspect/visit the generated routes. This exported checkout lacks the platform identity and Figma CLI needed for Make verification. The standalone Vercel target preserves the Payload/Figma configuration and managed routes.
- Provision a trusted server identity, authorized Auth domains, and scheduled retention/reconciliation jobs on compatible Node hosting.
- At the last inspection, the shared live database had root `.read: true` and `.write: true`. API authorization does not protect against direct database access under those rules. Review shared AttendIt access before changing them. `firebase.database.rules.json` is a candidate and must not be deployed wholesale; follow the merge/review procedure in [FIREBASE.md](FIREBASE.md).

## Project structure

```text
src/app/(frontend)/     Frontend pages, layout, and styles
src/app/api/study/      Trusted study API routes
src/app/(payload)/      Platform-managed Payload admin/API routes
src/components/        Study UI and administrator screens
src/lib/               Firebase integration, presentation, grading, and models
src/lib/server/        Trusted authentication, events, and analytics
scripts/               Import, verification, claims, and maintenance tooling
tests/                 Unit, emulator, and live workflow tests
public/                Public assets, including the book favicon
docs/                  Operations guides, reports, and verification evidence
.figma/make/           Figma Make lifecycle configuration
```

Environment files, private reviewer documents, extraction output, database backups, and credential files are excluded by `.gitignore`. Keep them out of public assets and source control.

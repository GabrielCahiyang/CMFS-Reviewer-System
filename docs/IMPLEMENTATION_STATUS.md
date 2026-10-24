# Implementation status

24 October 2026, Asia/Manila. All six supplied sources are imported into the live Realtime Database. See [source import and test results](SOURCE_IMPORT_REPORT.md).

## Implemented locally

- [x] Git-ignored `.env`; Firebase reads public configuration without embedded fallbacks.
- [x] Firebase-driven student UI, concise copy, provenance/version-aware question loading, archived session results and category-scoped mistake lookup.
- [x] Trusted session saves: server field allowlists, revision conflicts, pinned definitions, server time and grading.
- [x] Authenticated/rate-limited/idempotent telemetry, focused listeners and paged older history.
- [x] Claim-protected admin reports, daily summaries, paged events/directory, student scores/timeline, question insights and CSV exports.
- [x] Conservative extraction, private raw references, QA gates, dry-run/diff/backup, atomic versioned publish, read-back verification and rollback.
- [x] Candidate rules, merge tooling, claim assignment/revocation, reconciliation and retention commands.
- [x] Privacy notice and own-data export.

## Checks

- [x] 40 unit tests passed, including deterministic dynamic formats, exact custom selection and trusted scoring.
- [x] TypeScript passed after implementation.
- [x] 5 local database security tests passed.
- [x] Auth+Database emulator server workflow passed: saves/regrading, immutable completion, idempotent start/completion and admin authorization.
- [x] All 24 frontend routes returned development HTTP 200. See `docs/verification/preview-routes.json`; this is not production route-table verification.
- [x] Browser: local student login, session settings, MCQ green/red feedback, true/false, identification alternatives, unordered enumeration, completion/results, and student rejection from admin reports. Test fixtures were local emulators only.
- [x] Dynamic formats: the same source question can be presented in every answer format; custom selection shows original numbers, full text and previews. Twelve live HTTP workflows passed across six categories (`verification/dynamic-format-flow.json`).
- [x] Live browser: selected original questions 1 and 3, converted to true/false, saved, deliberately refreshed/resumed, completed and scored 100%. Screenshots are in `screenshots/dynamic-question-*.png`.
- [x] Local dev reload loop: Turbopack repeatedly rebuilt with no source changes. The local dev runner now uses webpack; verified stable during settings, saving, refresh and completion.
- [x] Standalone Vercel build passed with TypeScript enabled: 24 public static pages and four dynamic Node APIs. Local production HTTP checks passed for all pages, anonymous API rejection, favicon, unknown-route 404 and excluded Payload routes. See `verification/vercel-production.json`.
- [x] 41 unit tests passed after adding sanitized, project-matched hosting credential validation. The production API trace contains no Payload or Firebase CLI dependencies.
- [x] Corrected the later Vercel packaging failure: use standard root-app filenames instead of custom extensions. Next now generates all four required API client-reference manifests. All 3,018 file references across eight server traces exist; every standalone build now checks this before success. Forty-three unit tests and production HTTP/asset checks passed. See `verification/vercel-production.json`.
- [x] Reproduced Vercel's `jwks-rsa` / `jose` cold-start `ERR_REQUIRE_ESM`, added a scoped pnpm dynamic-import patch and regression tests with synchronous ESM loading disabled. Forty-six unit tests passed. Frozen patch-lockfile compatibility passed with pinned pnpm 10.34.3.
- [x] Session/report clients now show useful HTTP errors for empty or HTML platform failures. Applied and verified the live session `updatedAt` query index, preserving all existing permission grants and unrelated rules.
- [x] Rebuilt production successfully with the cold-start and file-trace gates. With `--no-experimental-require-module` applied to the production server, all eight anonymous/malformed-token API cases returned JSON 401, all 24 pages loaded, and 16 client assets were fetched. See `verification/vercel-runtime-fix.json`. The current hosted release still needs the new code deployed.
- [x] Removed the blanket answer-verification banner and pending-generated-answer messages. Grading now uses available keys rather than content-review labels; client, trusted session saves and reporting share that rule. Fifty unit tests and three imported-bank checks passed. A local production server with live Firebase saved, graded and exported all 64 Financial Statements questions at 64/64; its disposable account was cleaned up. See `verification/keyed-grading.json`. No bank/source labels were rewritten and historical completed attempts were not mutated.
- [x] Removed the session's Saved/Saving indicator and network locks on answers/navigation. Local state updates immediately; an account-scoped browser draft and serialized background queue preserve pending work, combine rapid edits, recover after refresh and ignore stale acknowledgements. Nine queue regression cases cover slow requests, dropped responses, offline retries, conflicts and final submission. Live Firebase verification processed 165 rapid edits/navigation during a delayed save in two writes, then saved/exported 64/64; the disposable account was removed. See `verification/instant-session.json`. Native browser interaction remains unverified because computer control is disabled in Work settings.
- [ ] Configure and verify Vercel environment variables, trusted Firebase server identity, actual remote deployment and authenticated production saves. See [Vercel deployment](VERCEL_DEPLOYMENT.md). No remote release or hosted environment changes were performed by the standalone build fix.

## Verify production delivery — pending

- [x] Receive/extract all six original files; preserve exact counts and visually inspect highlighted keys. Generated content remains explicitly flagged pending instructor review.
- [ ] Provision trusted Firebase server identity on compatible hosting; web configuration alone cannot authorize live admin/seeding.
- [ ] Inspect/merge/test/deploy actual live rules without replacing unrelated AttendIt rules.
- [ ] Choose intended administrator UID and assign the claim through trusted tooling.
- [x] Apply reviewed import; record source counts/coverage/flags/import ID/hashes and verify read-back: 465 records, all six banks.
- [ ] Configure 90-day raw-event retention and reconciliation schedules.
- [ ] Build in the connected Make lifecycle: local `pnpm build` stops at missing Figma environment identity.
- [ ] Run `figma make verify-deploy`, inspect route table and require static public shells. Figma CLI is absent locally.
- [ ] Visit every generated production route; verify actual Auth domains, cross-device saves, imported types, reports and requested images.

Live seed/read-back and all six full-bank HTTP workflows passed with real Firebase authentication. The disposable test account and sessions were removed. Database rules, administrator claims and production publication were not changed. Required framework skills are unavailable locally; Payload source, generated types and managed routes were preserved.

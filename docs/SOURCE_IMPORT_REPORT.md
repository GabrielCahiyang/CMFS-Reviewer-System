# Source import and live verification

Imported into `attendit-350c6` Realtime Database on 24 October 2026 (Asia/Manila).

| Source | Imported questions | Source-verified | Review required |
| --- | ---: | ---: | ---: |
| NEW REVIEWER.docx | 60 | 58 | 2 |
| CFMS-Questionnaire (1).docx | 121 | 121 | 0 |
| HUHUHUHU (1).docx | 120 | 120 | 0 |
| Practice-Questions-Pre-Finals_Answered_Familiar_Bisaya-English.pdf | 85 | 82 | 3 |
| Working Capital Management and Cash Management Answers (1).pdf | 39 | 31 | 8 |
| basic-understanding-of-a-companys-financials (2).pdf | 40 derived | 0 | 40 |
| **Total** | **465** | **412** | **53** |

All 425 original questions were preserved, with supplied answers wherever present. The financial-statements PDF is a 35-page teaching reference; its 40 questions/answers are explicitly generated, page-linked drafts for instructor review. Pre-finals item 46 has no valid listed source answer; a generated conceptual answer is labeled separately while preserving that source warning. Generated answers are not presented as instructor-verified.

The CFMS file contains 121 question/key pairs despite its 120-item heading. Printed labels `10-102` and `1117` are preserved with their source sequence. HUHUHUHU's Word numbering restarts; question sequence matches the complete 120-entry supplied key. Working Capital has 39 original questions because number 10 is absent; number 13 uses a comma. Its flattened colored highlights were extracted and visually checked on all question pages. Multiple highlighted choices in items 7 and 9 and inconsistent rationales remain flagged. No missing numbered source question was fabricated.

Live import ID: `import-6dc68a5fd1fd05f8adc655ee`.

Paths changed: `cfms/categories/<six category IDs>`, `cfms/questions/<six category IDs>`, version archives under `cfms/questionBankVersions`, the import audit under `cfms/sourceImports`, and a temporary cooperative import lock. Original sources, extraction output, field-level diff and backups are private/Git-ignored. Unrelated AttendIt records were not changed. The live banks were empty before this import.

`pnpm seed:verify` read back all six banks, metadata and version archives and matched their hashes/counts. The reviewed import can be reproduced using `CFMS_USE_FIREBASE_CLI=true` and the scripts without copying or printing CLI credentials. Backup: `private-backups/import-6dc68a5fd1fd05f8adc655ee-1792842644017.json`.

## Automated results

- 34 unit tests passed.
- TypeScript passed.
- 3 imported-bank tests passed: all 465 keys, supported runtime shapes, provenance and source numbering defects.
- 6 complete emulator integration tests passed: each category completed practice, exam, mixed study and flashcards using **all** its imported questions (24 full-bank sessions; 1,860 question responses).
- The **live app HTTP smoke test passed**: real Firebase email/password authentication; start/save/resume/submit/score for all six complete banks; account export; blocked student access to admin API; blocked anonymous export. The disposable Auth account and all its study sessions were removed afterwards. No fake activity events or scores were added to production analytics.
- Machine-readable live evidence: `docs/verification/live-system-smoke.json`.

## Remaining deployment and security limits

The live Realtime Database currently has root `.read: true` and `.write: true`. Those existing rules were preserved because the project is shared; restrictive child rules cannot override those root grants. The API checks passed, but **the database itself is not private or protected against direct writes**. Narrowing the root rules needs review of AttendIt's root-level reads/writes before applying the CFMS candidate rules. Do not treat this as a passed live database security audit.

Local development reuses the existing signed-in Firebase CLI for the trusted server. Production hosting still needs an attached trusted identity. The Make production build remains blocked in this exported checkout by missing Figma environment identity and the absent Figma CLI. A successful local/live Firebase smoke test is not a verified production publication.

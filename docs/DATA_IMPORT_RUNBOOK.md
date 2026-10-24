# Reviewer import runbook

The six original documents are authoritative. Originals, raw extraction, staging JSON and backups are private and ignored by Git. Do not publish them in `public/` or import staging JSON in the frontend. Real document formatting may require parser refinement once the files arrive.

1. Place the files in `private-source-reviewers/`, matching `scripts/source-manifest.json`. Run `pnpm seed:extract -- --source-dir ./private-source-reviewers`.
2. Review `seed-output/QA_REPORT.md`, ordered lines, DOCX HTML and PDF page/highlight references. Visually inspect highlighted/flattened PDF answers. Word automatic numbering needs comparison; DOCX page numbers are not invented. Scanned pages need OCR. Highlighted answer identities are never guessed.
3. Compare every question, choice, number, answer and explanation with the source. Preserve formulas and Bisaya-English wording. Resolve duplicate/orphan keys, unparsed key text, missing numbers and count mismatches. Fix parser issues and rerun, or make reviewed corrections in private staging files.
4. Stage records in `seed-output/questions/<categoryId>.json`; category metadata/counts/types are in `categories.json`. MCQ `correctAnswer` must match exactly one choice text; preserve the source letter separately. Enumeration uses arrays. Alternatives require approval. IDs are stable `q-001` etc.; never merge categories or deduplicate across sources.
5. Keep NEW REVIEWER item 39 flagged. Ambiguous/absent keys stay `review-required`. The Financial Statements teaching PDF produces no automatic invented questions: prepare clearly derived questions with concrete source pages, complete answers and a named human `reviewedBy` before marking verified.
6. Set each source's `extractionReviewed` in `manifest.json` only after full comparison. Set `numberingReviewed`/`answerKeyReviewed` only after resolving those warnings. Mandatory count mismatches remain blocking. All six banks must validate before any database connection/write.
7. Run `pnpm seed:validate`. It reports counts/coverage/flags and the deterministic final import ID. Reviewed corrections produce new versions; identical reviewed files yield the same ID.
8. Configure trusted server access and run `pnpm seed:preview`. Review private `DATABASE_DIFF.json`, especially published answer changes. This does not write. Existing unversioned attempts cannot be mapped to an old bank automatically: preserve them as provisional or review an explicit migration before replacing their bank.
9. Apply the exact reviewed artifact using `pnpm seed:apply -- --confirm-import-id <id>`. Existing answer-key changes additionally require `--approve-answer-changes`. The importer locks, backs up touched records, verifies staged archives, then atomically publishes all six banks with actual counts/import metadata. Unrelated paths remain untouched.
10. Run `pnpm seed:verify` for active bank/category/archive read-back hashes. Verify one original question of every supported type per source in the app. Record counts, verified/flagged totals, import ID, source hashes and applied time.

Extraction review flags are not a substitute for the actual source audit. The app never starts a seed automatically.

## Rollback

Staging failure leaves the published bank intact. The final publish is atomic. If later verification fails, review the recorded private backup and restore:

```
pnpm seed:rollback -- --backup private-backups/<recorded-file>.json --confirm-import-id <current-id>
```

Restoration is scoped to that backup's categories and questions. Archives remain for historical sessions. Recheck hashes and counts. Code rollback does not roll back Firebase data.

Rules have separate timestamped backups from the merge script. Restore a reviewed full live-rule backup through trusted tooling/console, preserving unrelated namespaces. Never replace shared rules with the standalone candidate.

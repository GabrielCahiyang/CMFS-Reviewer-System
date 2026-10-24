# Analytics operations

Open `/study-admin` with the trusted `cfmsAdmin` custom claim. Hidden navigation is a convenience; the API and rules enforce access. Students see an access-required state.

Overview covers active students, app sign-ins, starts/completions, graded accuracy, foreground time, flashcard counts, daily trends and reviewer performance. The directory includes only CFMS app identities observed through trusted Auth lookup; unrelated AttendIt users are not enumerated. Student detail shows scores and an activity timeline. Logs filter by UID, reviewer, event, mode and dates. CSV exports contain the loaded page. Question insights summarize completed wrong/partial/skipped/flagged items.

Activity describes app usage, not security sign-in history or proof of understanding. Auth restoration is not a new interactive login. Reading stops on blur/hidden/navigation/page exit, aggregates once a minute and is bounded. Full free-text answers stay in sessions, never in events.

Idempotent transactions update `cfms/analytics/daily/<Manila date>` with daily totals, per-user/category/question summaries and a private processed-event ledger. Validated results live at `cfms/analytics/scores/<uid>/<sessionId>`. Flashcards do not affect graded accuracy. Legacy/unresolved keys stay provisional.

Overview ranges use full Asia/Manila days. Event queries use exact timestamps and indexed 200-record scan pages with timestamp/key cursors; filtered empty pages can still have older matches. Directory pages contain 50 identities. Student score detail returns at most the latest 100 results in range. Completion rate compares starts/completions in that range and may exceed 100% when earlier sessions complete later.

## Reconciliation and scaling

```
pnpm analytics:reconcile
pnpm analytics:reconcile -- --apply
```

Dry run is the default. Replay uses the same event ledger, repairs missing summary writes and preserves concurrent ingestion. Missing validated scores are reported; restore the source version and retry completion ingestion to repair them. It does not destructively rebuild already processed totals.

Deploy trusted scheduled jobs for reconciliation and retention before production. No scheduler, Functions deployment or billing setup is assumed. The bounded in-memory client queue retries five times and clears on sign-out/account changes. Tab closure or exhausted offline retries can lose telemetry; the UI shows an activity warning and quiz saves remain independent. Do not invent missing historical reading/sign-in events.

Each daily bucket still grows with traffic. Larger deployments should add summary sharding, dedicated event indexes, compact directory summaries and paginated reconciliation. Monitor database bandwidth and latency. Production reporting has not been enabled or verified in this checkout.

# Privacy and retention

The sign-in and account screens disclose study telemetry: interactive sign-in/registration/logout, reviewer/question opens, approximate visible time, answer-submission identifiers, bookmarks, session lifecycle and scores. Administrators can view this data. Events exclude passwords, tokens, private keys, IP addresses and free-text responses. UID/time come from the server.

The raw-event policy is **90 days**. Before enabling production reporting, configure a trusted daily schedule to run `pnpm privacy:purge -- --apply` repeatedly until no expired events remain. Each run deletes at most 500. The command defaults to dry run; the policy is not automatically enforced without a schedule. Review retention with the owner before deleting live data.

Daily summaries, identifying deduplication ledgers, validated scores and saved study/profile records have a separate lifecycle until the owner defines a period or fulfills deletion requests. They are private and require inclusion in approved account deletion. Raw-event deletion alone is not complete deletion. Source archives remain private to authenticated study users.

The Account screen exports the learner's own study records through an authenticated API. Operational CSV exports are admin-only. Treat downloads as private. Learners contact their study administrator for access/deletion requests; no unsupported automatic account deletion is advertised.

For an approved deletion, verify identity/scope, export requested records, and use trusted tooling to remove only CFMS account data, directory/score entries, retained events for the UID and identifying daily ledger entries. Decide whether anonymous aggregate totals may remain. Auth is shared with AttendIt: deleting the underlying Auth account requires explicit confirmation of that cross-app impact. Record the operation without retaining deleted personal data. Code rollback cannot restore deleted data.

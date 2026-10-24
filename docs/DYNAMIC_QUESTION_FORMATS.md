# Dynamic question formats and selection

Choose an answer format in Session settings, then use **Choose questions** to select exact source questions by original number, full text or topic. Search, pagination and previews retain the selection. The session contains only those source IDs.

Multiple choice and true/false presentations are generated deterministically from the pinned source bank, session ID and supplied answer key. They stay consistent after refresh and resume. The browser and trusted scorer share the adapter. Source records and verification flags remain intact; uncertain keys still require review and do not count toward graded accuracy.

Verification: 40 unit tests, TypeScript, six emulator workflows, twelve live format/custom-selection HTTP workflows, and a live browser session selecting questions 1 and 3 through completion. See `verification/dynamic-format-flow.json` and `screenshots/dynamic-question-results.png`. Disposable test records were removed after testing.

The local Windows Turbopack process entered a continuous rebuild/reload loop without source writes. `npm run dev` / `pnpm dev` now use Next's webpack mode and respect `PORT` (default 3000). The server stayed stable throughout the final browser workflow. Stop the existing server before starting another on the same port.

Production delivery remains pending the connected Make environment and its required verification tools; local verification does not certify publication.

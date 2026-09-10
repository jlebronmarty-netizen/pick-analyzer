# Market persistence recovery forensic audit

Verdict: BLOCKED_PRODUCTION_ERROR_DETAIL_UNAVAILABLE. Production recovery and operational freshness are not certified.

The starting production/audit package is c133d12c8a37bf9f8933dace34b4d3c907738ee2. The preserved partial run executed bd87727f9072369349096d62a361b8439ab31f9c and remains FAILED / MARKET_PERSISTENCE at revision 43. Its four predictions, four mappings, 40 feature snapshots, committed raw/daily-feature data, and digest-verified private Odds response are unchanged.

## Evidence and reproduced behavior

The exact 88 observations were reconstructed using the certified market normalizer, source/event crosswalk, stored mappings and preserved Odds response. Deterministic identities, native scope, book/side assignments, American odds and acquisition/update/start ordering pass. The physical contract uses acquired_at, provider_last_update and commence_time; it does not require inventing an observed_at column. Current identity classification is 88 INSERT_ELIGIBLE, zero REUSE_NO_OP, zero BLOCK_CONFLICT. This is classification of the stored observation plan, not permission to bypass run-state or temporal gates.

The reconstructed request with the retained fence value 30 is 82,098 UTF-8 bytes, below the 400,000-byte writer target, 500,000-byte client limit and 524,288-byte Edge write limit. It fits one batch of 88 rows. The actual Edge request handler and runtime authority were exercised with disposable PostgreSQL, the real physical table columns, NOT NULL/default/unique/FK/check constraints, and a historical clock injected only in the disposable adapter. First pass inserted 88; second pass inserted zero and reused 88. Numeric values and all three timestamp fields match readback. Production clocks were not modified.

Fresh production schema preflight passed 406 columns, 116 preserved constraints and 84 indexes with zero orphan snapshot references. Prior read-only inspection confirms service INSERT/SELECT privilege and no INSERT trigger on the observation table. These checks do not identify a historical transient HTTP, database or runtime error.

The retained Vercel request record is a 503 for the 11:45 PR scheduled invocation. Its error-cluster lookup has no originating exception detail. The connected Supabase tool set does not expose Edge logs, and no local Supabase CLI management credential was available. The durable failure stores STATE_COMMAND_FAILED, which is insufficient to distinguish an HTTP rejection, a SQLSTATE, a malformed success envelope or a worker failure.

The old client was replayed with injected distinct SQL/HTTP responses: each becomes the same STATE_COMMAND_FAILED. A narrow diagnostic candidate now preserves only bounded HTTP status and a fixed SQLSTATE vocabulary, never response text, headers, URLs or credentials. The candidate's sender/receiver roundtrip and actual durable failure operation pass in disposable SQL. This proves the diagnostic defect, not that any particular injected failure caused the original production event.

## Gate status and containment

Gates 2-6 pass for the preserved observation plan and disposable persistence. Gate 1's originating production failure remains unresolved. Gate 7 has a tested forward diagnostic repair but cannot certify the originating classification. Gates 8-12 remain incomplete: no production resume, guard removal, observation insertion, value/pick decision, or new scheduled execution was attempted. Gate 9 explicitly requires earlier gates to pass, so the existing failure was not used as permission for a diagnostic production write.

The next needed evidence is the Supabase mlb-runtime-state invocation record around 2026-09-10 15:49:26-15:49:31 UTC: HTTP status, SQLSTATE, sb-error-code or termination classification, without secret values or payloads. No specific historical exception is invented. The preserved response remains usable as observation provenance, but it is no longer fresh evidence for a new Official Pick decision. Any later recovery must evaluate current start/freshness boundaries and preserve the original freeze.

This phase used zero provider calls, zero production DML and zero DDL. Mission Odds remains 4/20, with two legacy acquisitions separately retained. Production observations/values/picks for these five games remain zero. Four games have one prediction and ten linked snapshots each; HOU-PHI has neither because its evidence arrived after the original freeze. There are no new synthetic production paths or started-game writes. The released lease and unresolved failed-run guard continue to contain automation. NBA and MLB Cron configuration are unchanged.

The candidate is held on a review branch because its paired client/Edge diagnostic vocabulary must be deployed together after review; production remains on the existing package. Build, lint, 21 durable-state checks, five R7 checks, unchanged bearer-handler checks and the exact-plan full-handler replay pass. Private production-shaped input files remain outside the repository; this audit publishes structural evidence only. All 19 inherited worktree changes are preserved. No UI redesign was performed.

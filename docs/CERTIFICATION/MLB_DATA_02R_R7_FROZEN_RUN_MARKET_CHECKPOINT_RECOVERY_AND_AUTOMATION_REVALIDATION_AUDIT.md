# R7 forensic review — recovery not certified

Starting production package: `df1fb78e9a90d06becf6702b46158a34c2bfe974`.
The frozen run and its prediction remain intact. No production mutation or provider call was made by this review. MLB Cron remains disabled; NBA configuration is unchanged.

## Evidence and limits

The affected run is `automation-d380f6101b7ee019b63790b3342f24269cfb64e837782be4ebfe3a34acb987e2`, frozen on package `e49fd02cd98b95c3a1a50bc057290b66d09679b2`. Its run date is September 9 in Puerto Rico, with as-of `2026-09-10T00:00:48.874Z`. One eligible game produced one independently verified prediction. Runtime revision 10 has completed SCOPE, DEPENDENCY_SCOPE, CONTEXTS and FEATURES. Its prediction DML receipt reports one insert under cap one and PASS readback. No market observation, value or Official Pick was persisted for this freeze. The existing market mapping predates the run.

The run consumed two MLB Official reservations and one Odds reservation. The mission counter remains **3/20**. A reservation proves budget consumption, not successful provider delivery. Neither the original response nor its acquisition digest is in durable runtime state. Existing mappings, later acquisitions and prior prices cannot reconstruct that response with valid provenance. Storage has no buckets. No original-response record was found in the reviewed canonical, historical or sync evidence sources.

Vercel retains HTTP 503 at 00:00:42 and 00:15:42 UTC. The scheduler's catch block returned a sanitized HTTP response but did not log the exception or record it in durable state. The available logs contain no response body. Therefore the exact first exception and exact exception for each historical retry are **not established**. It would be incorrect to label a plausible market validation error, timeout, or reproduced resume guard as the observed first error.

## Reproduced mechanisms

The six checks in `scripts/mlb-operational-r7-forensics-validate.mjs` use disposable PostgreSQL and the existing runtime authority/run store. They reproduce:

- paid evidence being readable in one instance but lost in another, raising `R6_CHECKPOINT:ODDS_OUTCOME_UNCERTAIN`;
- reservation and mission accounting surviving that loss;
- a pending frozen run taking precedence over the next Cron identity across UTC midnight;
- changed-package rejection through `R6_STATE:FROZEN_PACKAGE_CONFLICT`;
- stale pending-run rejection after Puerto Rico midnight through `R6_STATE:STALE_PENDING_RUN_REQUIRES_REVIEW`;
- retained accounting and no active lease after rejected recovery attempts.

Both 23:59 UTC and 00:01 UTC use September 9 in Puerto Rico. UTC rollover itself does not change the pending run, scope or reservation identity. These passing diagnostics demonstrate defects and guards; they are **not** passing R7 repaired market recovery tests.

## Additional scheduler finding

Two later Odds acquisitions are recorded by `GITHUB_ACTIONS_PRODUCTION_OPERATING_DAY_FALLBACK`, using the older operating-day route. They are distinct from the frozen acquisition and absent from the R6 mission ledger. No calls were made by this R7 session. Do not reset the R6 ledger, silently merge unrelated accounting, reuse these acquisitions as frozen evidence, or assume the R6 Cron removal contains every MLB acquisition path. The existing GitHub workflow and its MLB/NBA ownership require reconciliation before single-coordinator certification. This review did not modify that inherited scheduler.

## Recovery decision and concrete next work

The frozen game's scheduled start has passed. Its appropriate disposition is **TERMINAL_PARTIAL_PRESERVED**, preserving the prediction, freeze, reservation receipts and all DML receipts. This is an assessment, not an applied production update. Gate 11 explicitly requires Gates 1–10 first.

Gate 1 requires the exact first exception. The review cannot manufacture it. A clarification is pending on whether that gate may explicitly accept `UNRECOVERABLE_OBSERVABILITY_GAP`. Until resolved, the report does not mark Gate 1 COMPLETE and does not advance production recovery or activation.

The repair must persist bounded, immutable provider evidence before downstream market normalization, with a deterministic reference tied to the frozen run and reservation; verify independent durable readback before reporting acquisition success; and retain an uncertain consumed reservation without automatic reacquisition if delivery or durable acknowledgement is lost. The R6 coordination table is explicitly limited to compact metadata, so a raw response must not simply be inserted into its checkpoint under a renamed field. No new production DDL is authorized. Any proposed durable backend must be reviewed against existing storage, access, size and write-target contracts before deployment.

Market interruption tests must exercise canonical mapping reuse, partial observation insertion, independent readback, completion and a second instance with zero additional Odds calls. They must also cover UTC midnight, stale/post-start refusal, immutable conflicts, lease fencing and checkpoint revision races. Diagnostics need bounded error codes and stage/revision identifiers without URLs, headers, raw payloads or secret-bearing exception text. A terminal-partial transition must use exact expected old state and preserve counters and immutable business rows.

Settlement remains `IMPLEMENTATION_CERTIFIED_PRODUCTION_DISABLED_PENDING_FIRST_SETTLEABLE_SAMPLE`; Performance remains `NO_SETTLED_SAMPLE`. Neither limitation is being used as the R7 blocker. Final operational certification is not issued.

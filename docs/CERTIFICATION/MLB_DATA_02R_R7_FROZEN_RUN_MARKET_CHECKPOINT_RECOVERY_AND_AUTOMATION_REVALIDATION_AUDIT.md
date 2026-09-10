# R7 current production checkpoint: endpoint deployment authorization blocked

R7 production checkpoint: candidate `be19887e3eb9f9f60359e89a81ee34e490c9ffe1` is published and Vercel Production READY. Fresh schema preflight and 12 UI checks pass; the legacy MLB writer returns a zero-call/zero-write no-op. The private JSON evidence bucket is provisioned and empty (one metadata creation; zero business/runtime DML, providers or DDL). Frozen revision 10 and its prediction remain unchanged; mission Odds remains 3/20, with two separate historical legacy acquisitions retained. Automatic approval review rejected deployment of the exact ten-file R7 Edge candidate twice because the earlier explicit approval covered eight files. Edge remains version 5. Exact candidate hashes and bearer tests are in `docs/CERTIFICATION/MLB_OPERATIONAL_R7_EDGE_DEPLOYMENT_APPROVAL_PACKET.json`. Frozen-run disposition, host revalidation, MLB activation and scheduled readback remain pending this deployment authorization. NBA is unchanged. Final operational certification is NOT ISSUED.

The actual published handler passes missing/wrong/public bearer denial before any database connection, and accepts server-only inspect in disposable validation. These are local candidate checks, not production readback of the undeployed endpoint. The historical first exception remains unknown and explicitly accepted as `UNRECOVERABLE_OBSERVABILITY_GAP`; no original Odds response exists and fresh prices cannot complete the expired freeze. `TERMINAL_PARTIAL_PRESERVED` remains the reviewed disposition, not an applied transition. Settlement stays `IMPLEMENTATION_CERTIFIED_PRODUCTION_DISABLED_PENDING_FIRST_SETTLEABLE_SAMPLE`, with zero production settlement writes and `NO_SETTLED_SAMPLE`.

## Earlier candidate and forensic checkpoints (historical)

# R7 repair — local certification complete, production readback pending

The user explicitly accepted Gate 1's `UNRECOVERABLE_OBSERVABILITY_GAP`. The exact historical exception remains unknown; no message is inferred or backfilled. This acceptance does not turn the old run into a success. The prior clarification request below is resolved.

The repaired candidate passes 72 disposable real-feature/Champion/R2 SQL checks, including independent-instance recovery after paid acquisition and partial observation insertion with exactly one Odds reservation. Five additional SQL checks cover UTC midnight, immutable object recovery before reference acknowledgement, atomic sanitized failure recording and exact-state expired disposition. Four storage/legacy-route security checks, 21 runtime-state checks, eight fenced-write checks, six provider-await checks, eight host checks, 27 schema checks, 17 behavior groups, targeted ESLint and the 400-page production build pass.

Provider evidence uses one private Storage bucket, `mlb-operational-evidence`, with JSON-only objects limited to 4 MiB and at most schedule/odds objects per run. Object identities bind package, run and provider reservation. Immutable create plus independent readback precedes downstream processing. The coordination table continues to contain compact references, never raw Odds responses. Bucket privacy, object RLS and absence of client object policies fail closed. This requires no DDL. A crash before durable acknowledgement still retains an uncertain consumed reservation and never authorizes automatic reacquisition.

The failure operation records server-authoritative run, stage, timestamp, revision, lease holder, provider counts and full DML accounting together with FAILED status. Messages use a strict code allowlist; arbitrary exception text is withheld. Stage markers precede prediction, Odds, market, value, pick and board processing. When the durable database itself is unavailable, a sanitized recording-failure event is emitted; no system can guarantee a database commit through a database outage or abrupt process kill.

The disposition operation requires an exact review digest, no active lease, expired native games, matching prediction readback and conflict-free DML receipts. It preserves the old package, freeze, prediction and counters. The physical state remains FAILED with an explicit `TERMINAL_PARTIAL_PRESERVED` disposition; the scheduler excludes only reviewed terminal partials from pending work. It does not relabel failure as COMPLETE.

Legacy ownership is reconciled: both branches of `/api/cron/operating-day` are explicitly MLB-only (the adaptive service fixes `SPORT_KEY='baseball_mlb'`, and the fallback passes literal MLB keys). Non-dry legacy requests now return a zero-provider/zero-write disposition before the planner. The GitHub writer schedule is removed; NBA's route and Cron are unchanged. Two historical legacy Odds calls remain separately reported; the R6 mission ledger remains 3/20. An initial automatic review rejection of this guard was resolved by inspecting and proving that MLB-only call graph before applying it.

Production bucket provisioning, endpoint deployment/readback, frozen-run disposition, host dry/concurrency, activation and natural scheduled readback remain pending at this candidate checkpoint. Final operational certification has not been issued.

## Preserved initial forensic review

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

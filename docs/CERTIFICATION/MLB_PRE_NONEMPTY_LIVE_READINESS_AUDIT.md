# PRE_NONEMPTY_LIVE_READINESS

The non-time-dependent implementation work is complete and validated. This is **not** final operational certification. The first nonempty live refresh, a subsequent real refresh proving repeatability, automation activation after those gates, and final operational certification remain pending.

## Completed scope

- Pitch-by-pitch automation reuses the canonical shared Statcast engine and `pick2_raw_mlb_statcast_pitches`. Pregame dependencies remain on R2; incremental/postgame/overnight reconciliation has an explicit bounded cache policy that does not mistake one stored pitch for a complete game. Per-slot cache, provider ledger, raw-plan checkpoints, immutable classification, batch caps, write journal, independent readback and zero-insert retries are preserved.
- Daily automation delegates to the certified R2 launcher for initialization, pregame, starter-change and odds-freshness modes. Intent is saved before invocation; an interrupted run resumes its unique original identity. One coordinator blocks overlapping modes and unfinished jobs; attempts are bounded. Production activation is disabled and requires actual nonempty/repeatability evidence.
- Settlement uses the existing moneyline settlement core, authoritative MLB final-feed identity/status/scores and a source digest. Results live in the existing `pick2_prediction_results` table; original predictions and Official Picks are not modified. Win/loss/push/void, original `settled_at`, immutable conflicts, SQL readback and reuse are tested. No production settlement ran.
- Performance reads only certified settlements, reports sample/date/model/policy scope, counts, win rate, one-unit theoretical units and supported ROI. Empty samples have no win rate or ROI. CLV remains unavailable because no certified closing-line evidence is bound; no profitability claim is made.
- Today, root, Value Board, Performance and Data Health use canonical database readers. The old dry-artifact Value Board fallback is removed. Prices, probabilities, edge and EV are persisted values; policy/freshness reuse existing engines. Missing/stale/started/changed-starter evidence blocks actionability. Reads select newest evidence per game rather than letting growing immutable history silently truncate the slate.
- Data Health distinguishes last published accounting from current coordinator telemetry. The prepared telemetry writer uses one deterministic existing `sports_sync_jobs` row per job, bounded old-value UPDATE predicates and readback. Exact private journals remain authoritative for each transition. No operational table DML ran during preparation.
- The recovery runbook and fresh read-only schema-preflight input tool are complete. Scheduled activation must include the existing authorized connector's SELECT-only catalog step before each tick; the 15-minute freshness guard is unchanged. No scheduler, cron or environment configuration was activated.

## Validation

The canonical JSON records the exact 16 behavioral groups, 12 desktop/mobile/API checks, 66 disposable PostgreSQL R2 integration checks, five R3 guard groups and three existing operational guard groups. Build exits zero with 400 static pages; changed implementation lint passes. Fresh schema readback verifies 406 columns, 116 preserved constraints, six native snapshot unique indexes and zero orphans/check violations. Physical settlement/telemetry schemas were read from production and reproduced in disposable SQL tests.

Browser verification caught the root layout's legacy dashboard provider attempting `model_weights` initialization. The network guard blocked those attempts before production; canonical routes now avoid mounting that provider. Final browser verification records **zero attempted forbidden requests**, 36 read-only database requests, no page errors, no horizontal overflow at 390/1365 pixels and canonical API parity. Light-theme warning contrast was repaired. Screenshots stay outside the repository.

The existing R3 certificate was renewed only for the shared reconciliation option: its default pregame behavior is unchanged, all 66 existing checks pass, and current normalized runtime hashes match. The earlier live package remains a historical frozen run, not silently relabeled as this implementation.

## Accounting and protected state

This work session: sports-provider calls 0, production DML 0, production DDL 0, live refreshes 0, automation activations 0, cron/environment changes 0. The mission's prior authorized live run used one MLB Official call and returned `NO_VALID_PREGAME_SLATE`; cumulative Odds and Statcast calls remain zero. The earlier single authorized DDL migration remains the only mission DDL. Champion, 76-feature definitions/order, preprocessing and Policy V1 are unchanged.

The 19 inherited generated artifacts remain untouched and excluded from the bounded commit. `.tmp/` and `.worktrees/` are untouched. Public evidence contains structural checks, aggregate accounting and source hashes; raw samples, production payloads, credentials and private journals are excluded.

## Next genuine slate

Follow `docs/MLB_OPERATIONAL_RECOVERY_RUNBOOK.md`: verify the selected package and fresh schema, freeze actual Puerto Rico date/start once, execute a genuine eligible current-slate refresh, independently read back the full chain, then perform a subsequent valid refresh for real repeatability. Only then activate the prepared single-coordinator schedule and issue final operational certification after its remaining live checks. Do not use started/postgame games as pregame substitutes.

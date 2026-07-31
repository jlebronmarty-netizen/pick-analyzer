# Release 02 Core User Journey

Status: REPOSITORY CERTIFIED

This trace documents the existing production journey without changing product behavior.

## Journey Trace

| Transition | Producer | Consumer | Persistence Object | State Field | Timestamp | Expected Invariant | Actual Repository Evidence | Failure / Fallback State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Operating Day -> Event Discovery | `src/services/operating-day.service.ts` and scheduler routes | `src/services/pregame-scheduler-coverage.service.ts` | `sport_events`, `operating_days`, `operating_day_lifecycle_events` | `status`, `start_time`, lifecycle status | `created_at`, `started_at`, `completed_at` | Operating date resolves in America/Puerto_Rico for MLB. | `pregame-scheduler-coverage.service.ts` uses `TIMEZONE = 'America/Puerto_Rico'` and `resolveMlbOperatingDate`. | Scheduler evidence reports `NO_EVIDENCE`, blocked, failed or missed-window reasons. |
| Event Discovery -> Odds/Data Availability | odds acquisition and stored snapshots | current board, Today, coverage diagnostics | `sports_odds_snapshots` | `snapshot_time`, `market`, `outcome`, `price` | `snapshot_time`, `created_at` | Odds must be stored before cutoff for priced recommendations. | `dashboard-today.service.ts`, `current-board.service.ts` and `market-opportunity-suite.service.ts` evaluate odds freshness and cutoff alignment. | `NO_ODDS`, `STALE_MARKET`, `NO_ALIGNED_PRICE`, `EXPIRED_PREGAME_PRICE`. |
| Odds/Data Availability -> Eligibility | recommendation and cutoff services | current board, official pick contract | `prediction_history`, candidate contracts | `production_eligible`, `recommended_pick`, `validation_status` | `generated_at`, `cutoff_at` | Eligibility is separate from high probability and positive EV. | `official-pick-experience.service.ts` delegates policy to `recommendation-eligibility-policy.service.ts`; no thresholds changed. | Candidate remains Model Only, Watchlist, Pass or Avoid. |
| Eligibility -> Pregame Prediction | prediction services and operating-day workflow | persistence, current board, Today | `prediction_history` | `generated_at`, `cutoff_at`, `commence_time`, `is_current` | `generated_at`, `cutoff_at` | Persisted predictions must be generated before event cutoff/start. | `prediction-cutoff-enforcement.service.ts` classifies `PREGAME`, `POST_START`, `POST_FINAL`, `INVALID_CUTOFF`; current-board and performance scopes consume cutoff fields. | Post-start/post-final rows are excluded from production performance and surfaced as invalid/diagnostic. |
| Pregame Prediction -> Persistence | prediction history service and operating-day service | read models and dashboards | `prediction_history` | `idempotency_key`, `is_current`, `status`, `result` | `created_at`, `updated_at`, `generated_at` | No duplicate current prediction identity should appear for the same market and model scope. | `pregame-scheduler-coverage.service.ts` computes duplicate idempotency/current identity diagnostics. | Superseded rows remain diagnostic; current surfaces filter canonical rows. |
| Persistence -> Product Surfaces | `dashboard-today.service.ts`, `current-board.service.ts`, model-only and performance contracts | home, current board, Model Only, Most Likely, Official Picks, AI feed, performance | read-only API contracts | canonical selector status, lifecycle, freshness, counts | `generatedAt`, source timestamps | Product cards must show current, stale, empty or blocked states without fabricating picks. | `/api/dashboard/today` has no-store headers, degraded fallback and provider/mutation guardrails; Today uses current-board, scheduler coverage and learning summaries. | HTTP 200 degraded fallback with warnings and zero provider calls/mutations. |
| Event Final -> Settlement | settlement reconciliation and guarantee services | learning/performance | `game_results`, `prediction_history` | `result`, `status`, `settlement_details`, `settled_at` | `settled_at` | Final events with valid pregame predictions settle exactly once or become explicitly blocked. | `canonical-settlement-state.service.ts`, `settlement-reconciliation.service.ts` and `settlement-guarantee.service.ts` classify deterministic outcomes and pending reasons. | `ELIGIBLE_FOR_SETTLEMENT`, missing result, unsupported market, invalid cutoff or blocked lifecycle. |
| Settlement -> Learning Label | canonical settlement state and learning services | calibration/performance | `prediction_history`, model learning records | `settlement_details`, label evidence | `settled_at`, learning update time | Learning uses only valid settled pregame predictions. | `canonical-settlement-state.service.ts` computes `learningIncluded`; `performance-scope-v2.service.ts` excludes legacy, test, post-start and superseded rows. | Invalid rows are excluded from learning and performance. |
| Learning Label -> Calibration/Performance | model-learning, performance scope and AI performance center | performance page, AI operations | `model_weights`, `ai_performance_snapshots`, `prediction_history` | model/performance metrics | `created_at`, `settled_at` | Calibration/performance must not include contaminated rows. | `performance-scope-v2.service.ts`, `ai-performance-center.service.ts` and performance routes disclose cutoff exclusions and production scope. | Insufficient samples remain visible as insufficient data rather than fabricated confidence. |

## MLB Priority

MLB remains the primary active operating board. The Release 02 trace therefore prioritizes `baseball_mlb` services and shared architecture rather than building sport-specific parallel pipelines.

## Reconciliation Counts

These counts are repository-certification counts, not production row counts:

| Count | Value |
| --- | --- |
| Canonical app/API/layout route entries from Release 01 | 455 |
| API routes from Release 01 | 426 |
| Parsed database objects from Release 01 | 127 |
| Core journey transitions certified | 9 |
| Provider calls made by Release 02 checks | 0 |
| Database mutations made by Release 02 checks | 0 |

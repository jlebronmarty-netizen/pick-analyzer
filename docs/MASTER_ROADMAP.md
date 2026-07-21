# Master Roadmap

This roadmap is dependency-aware and based on repository inspection. A module is marked completed only when the repository contains service/API/dashboard/persistence evidence and recent verification supports it.

## Dependency Reasoning

MLB is now production stable and in maintenance mode. The primary roadmap focus is BSN, basketball intelligence, basketball prediction readiness after data maturity, AI market intelligence expansion and then additional sports. MLB work should remain limited to maintenance unless a future explicit major project authorizes architecture or model changes.

## Completed

### MLB Automatic Player Discovery V1

Status: Implemented locally. Certification: `MLB_AUTO_PLAYER_DISCOVERY_PASS`. Production deployment and smoke validation are required before starting the current-season backfill orchestrator.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `src/services/mlb-unresolved-player-identity.service.ts`, `src/app/api/mlb/players/unresolved-identities/route.ts`, `src/app/api/operations/validation/route.ts` and `docs/mlb-auto-player-discovery.md`.

Note: SportsDataIO MLB player-stat imports now create or reuse provisional unresolved identities through existing `provider_entity_mappings` with `entity_type='unresolved_player'`, keeping trusted canonical mappings isolated under `entity_type='player'`. The workflow preserves provider player ID, provider name, team ID, source date, source stat ID and review status, marks records non-production/review-required, and never assigns a trusted `sport_players.id` from fuzzy name matching. The stored-data reconciliation route defaults to dry-run and writes only provisional identity rows or exact trusted identity links when protected and confirmed. Build passed with 0 provider calls.

### SportsDataIO PlayerGameStatsByDate Endpoint Optimization V1

Status: Endpoint timeout root cause diagnosed locally. Certification: OPTIMIZED. Historical import remains stopped until explicitly resumed.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts` and `docs/SPORTSDATAIO_PLAYER_GAME_STATS_ENDPOINT_OPTIMIZATION.md`.

Note: One direct read-only diagnostic call to `PlayerGameStatsByDate/2026-JUL-17` returned HTTP 200 with 418 rows, 646,490 decoded bytes, 1093 ms to headers, 1121 ms to first byte, 13,945 ms body download, 15,041 ms total response and 142 ms JSON parse time. No rate-limit or retry-after header was present. Root cause is client-side timeout margin, not entitlement, server failure, rate limiting or JSON parsing. The only code change was raising the MLB Discovery historical transport default timeout from 15 seconds to 60 seconds. No import/backfill retry was run.

### SportsDataIO MLB Data Maximization Budget Fix And Controlled Extraction V1

Status: Budget fix implemented and validated locally. Certification: BLOCKED. Full extraction is stopped by a real pilot timeout.

Evidence: `src/services/provider-budget.service.ts`, `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `docs/SPORTSDATAIO_MLB_DATA_MAXIMIZATION_BUDGET_FIX_AND_CONTROLLED_EXTRACTION.md` and `sports_sync_jobs` pilot evidence.

Note: Read-only provider budget status no longer returns HTTP 500 when lifecycle accounting is unavailable; it degrades with typed warnings, uses safe defaults, reports malformed numeric config, treats missing usage as zero, and makes zero provider calls. Live MLB historical import now checks the shared budget guard and blocks immediate retry after recent failed/partial/running checkpoints. Network-enabled local validation returned accounting `AVAILABLE`, configuration `VALID`, 5 calls today, 0 last hour and validation 14/14. The controlled pilot for `PlayerGameStatsByDate/2026-JUL-17` consumed 1 call and timed out with 0 rows. The immediate rerun consumed 1 more call under old behavior, so retry-cooldown hardening was added; post-fix retry verification did not increase provider usage. Do not run full current-season backfill until the timeout is resolved.

### SportsDataIO Entitlement Discovery And Safe Extraction V1

Status: Read-only entitlement discovery completed locally. Certification: PARTIAL. New extraction remains deferred until exact full entitlement and historical budget scope are approved.

Evidence: `src/services/sportsdataio-subscription-maximization-audit.service.ts`, `src/app/api/providers/sportsdataio/maximization-audit/route.ts`, `src/app/api/operations/validation/route.ts` and `docs/SPORTSDATAIO_ENTITLEMENT_DISCOVERY_AND_SAFE_EXTRACTION.md`.

Note: The safe discovery pass made exactly 10 external SportsDataIO calls and 0 remote mutations, with no secret exposure. Representative entitlement was verified for MLB metadata/current season, teams, GamesByDate schedule/results/starters/weather, standings, players, player game stats endpoint access, team season stats, GameOddsByDate odds, NBA teams and NBA injuries. The audit now adds entitlement status, probe evidence and historical extraction policy to each cataloged endpoint. Extraction did not run because 117 cataloged endpoints remain unprobed under the approved cap, no account entitlement export is available, local provider budget precheck returned HTTP 500, and historical depth was not proven beyond current-season/single-date probes. Utilization remains 14.2%. BSN was not started.

### SportsDataIO Subscription Maximization Audit V1

Status: Read-only audit implemented locally. Certification: PARTIAL. New ingestion is deferred until exact subscription entitlement and rate-limit evidence are available.

Evidence: `src/services/sportsdataio-subscription-maximization-audit.service.ts`, `src/app/api/providers/sportsdataio/maximization-audit/route.ts`, `src/app/api/operations/validation/route.ts`, `src/config/sportsdataio-endpoint-catalog.ts` and `docs/SPORTSDATAIO_SUBSCRIPTION_MAXIMIZATION_AUDIT.md`.

Note: The audit composes the current endpoint catalog, runtime adapter evidence, server-only env key-name checks, provider budget summary and stored table counts. Local smoke reports 127 cataloged endpoints, 7 USED, 22 PARTIALLY_USED, 98 NOT_USED and estimated weighted utilization of 14.2%. It identifies Critical/High ROI domains but does not start new ingestion because repository evidence cannot prove the exact purchased SportsDataIO plan, full endpoint entitlement matrix or per-key rate limits. Provider calls 0, remote mutations 0, build passed, and no prediction, recommendation, Current Board, settlement, scheduler, dashboard or provider-refresh behavior changed.

### BSN Foundation V1 Continuation

Status: Phase A source audit completed locally. Certification: PARTIAL. Stop gate reached before data-lake, scheduler, shadow-governance, settlement-foundation or UI expansion.

Evidence: `docs/BSN_FOUNDATION_V1_CERTIFICATION.md`, `src/services/basketball-source-framework.service.ts`, `src/services/basketball/connectors/official-bsn-homepage.connector.ts`, `src/services/basketball/acquisition/bsn-acquisition-engine.ts`, `src/services/bsn-platform.service.ts`, `docs/bsn-integration-v1.md`, `docs/bsn-source-framework-v1.md` and `docs/bsn-data-acquisition-strategy.md`.

Note: The audit confirmed the current BSN stack has a reusable foundation, but no permissioned production BSN API/feed is configured. Official public HTML remains suitable only for discovery and limited foundation snapshots unless written authorization is obtained. CSV/manual paths are validation-first and write/audit blocked. Verified BSN odds and approved boxscore/game-stat coverage remain unavailable. Provider calls 0, remote mutations 0, and no prediction, recommendation, Current Board, settlement, scheduler or provider logic changed. NBA has not started.

### BSN Wave 2 Core Certification V1

Status: Implemented locally. Certification: PARTIAL. Stop gate reached at Phase 2; BSN Core completion cannot continue until verified BSN odds/stat/source gaps are resolved.

Evidence: `src/services/bsn-core-certification.service.ts`, `src/app/api/bsn/core-certification/route.ts`, `src/app/api/operations/validation/route.ts`, existing BSN data quality, Current Board readiness, operations readiness, intelligence validation, shadow prediction validation, model maturity, backtesting and calibration routes.

Note: Wave 2 reused the existing Sports Brain instead of recreating MLB. Phase 1 reuse certification passed for Prediction SDK, market alignment, recommendation explanations, Official Pick Experience and AI Feed. Local smoke confirmed `/api/bsn/core-certification?includeValidation=true` returns `BSN_CORE_PARTIAL`, `stop=true`, provider calls 0 and remote mutations 0. The required Phase 2 stop gate is caused by missing verified BSN odds, missing BSN game statistics, required approved BSN source ingestion, insufficient V7 shadow/calibration samples for production activation, and moneyline/spread/totals blocked by no verified odds. Existing BSN shadow backtesting remains available with 38 graded games, 28 correct, 10 incorrect, 73.68% accuracy and 0.21 Brier score. No prediction engine, Current Board, dashboard, recommendation, explanation, settlement, scheduler, provider budget, health, backtesting, calibration, risk or Kelly service was duplicated. NBA has not started.

### MLB Phase 6 Player Props Data Foundation V1

Status: Foundation implemented locally. Certification: BLOCKED. Phase 7 must not start.

Evidence: `src/services/mlb-player-props-foundation.service.ts`, `src/app/api/mlb/player-props/foundation/route.ts`, `src/app/api/operations/validation/route.ts`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/config/sportsdataio-endpoint-catalog.ts` and `supabase/migrations/202607130002_sport_player_stats_v1.sql`.

Note: Phase 6 adds a provider-independent `mlb_player_props_foundation_v1` readiness contract and read-only API. It catalogs pitcher strikeouts, outs recorded, earned runs, hits allowed, walks allowed, pitches thrown, batter hits, total bases, runs, RBI, home runs, walks and strikeouts. It defines canonical player, provider mapping, participation, historical player game log, prop odds, result/settlement, feature, data-quality, lineage and import-checkpoint contracts using existing storage where possible. Local audit found stored MLB player identity and stats coverage but zero stored player prop odds. Phase 7 is blocked by unconfirmed MLB player prop odds endpoint entitlement, no stored player prop odds snapshots and missing player-prop settlement rules. Local validation passed 11/11, provider calls 0, remote mutations 0 and build passed. No migration was applied. Prediction formulas, recommendation policy, categories, ranking, Official thresholds, provider integrations, settlement and learning remain unchanged.

### MLB Phase 5 AI Picks Feed V1

Status: Implemented and validated locally. Production deployment remains pending explicit authorization.

Evidence: `src/services/mlb-ai-picks-feed.service.ts`, `src/services/current-board.service.ts`, `src/services/dashboard-today.service.ts`, `src/app/api/operations/validation/route.ts` and `src/components/dashboard/UserTodayPanel.tsx`.

Note: Phase 5 adds an additive read-only `mlb_ai_picks_feed_v1` contract that derives feed items from existing Current Board candidates and preserves `official_pick_v1`, `market_alignment_v1`, `recommendation_explanation_v1` and selected odds lineage. Official Pick and Best Bet Today labels require an existing official contract; informational feed items remain labeled Most Likely, Best Value, Watch Closely, Hidden Value, Avoid, Data Risk or Market Update. Local validation passed 13 AI Picks Feed checks, `/api/current-board?includeValidation=true` returned 23 feed items from 12 candidates, and `/api/dashboard/today?includeValidation=true` exposed the feed section with provider calls 0 and remote mutations 0. Prediction formulas, category assignment, ranking, Official thresholds, recommendation policy, provider integrations, settlement, learning and unsupported markets remain unchanged. Phase 6 has not started.

### MLB Phase 4 Official Pick Experience V1

Status: Implemented and validated locally. Production deployment remains pending explicit authorization.

Evidence: `src/services/official-pick-experience.service.ts`, `src/services/current-board.service.ts`, `src/services/dashboard-today.service.ts`, `src/app/api/operations/validation/route.ts` and `src/components/dashboard/UserTodayPanel.tsx`.

Note: Phase 4 adds an additive `official_pick_v1` presentation contract and `official_pick_experience_v1` Today/Current Board section using only existing Current Board, odds lineage, market alignment, recommendation explanation and recommendation-policy evidence. The dashboard now shows a premium Official Pick card when policy-qualified picks exist and a truthful empty state when zero Official Picks exist, while keeping Top AI Opportunity informational. Local validation passed 14 official-pick checks plus read-only Current Board/Today smoke with provider calls 0 and remote mutations 0. Official thresholds, category assignment, ranking, model formulas, recommendation policy, provider integrations, settlement and learning remain unchanged.

### Phase 3 Actionable Recommendation Explanations V1

Status: Implemented and validated locally. Production deployment remains pending explicit authorization.

Evidence: `src/services/recommendation-explanation.service.ts`, `src/services/current-board.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/app/api/operations/validation/route.ts` and `src/components/dashboard/UserTodayPanel.tsx`.

Note: Phase 3 adds a deterministic `recommendation_explanation_v1` contract shared by Current Board, Today/Top AI Opportunity and market insight rows. Explanations are grounded only in existing market alignment, probability, edge, EV, freshness, confidence, risk, feature/data sufficiency and blocker evidence. Operations Validation now includes 24 explanation fixture checks including stale/fresh, positive/negative/zero value, missing price/probability, line/selection mismatch, unaligned markets, Official threshold blockers, reason deduplication, blocker/reason priority, fair-odds labeling and fair-odds conversion. This phase does not change prediction formulas, category assignment, Official Pick thresholds, recommendation policy, Current Board ranking, market alignment formulas, provider integrations, settlement, learning or unsupported markets. Phase 4 has not started.

### Phase 2 Market Intelligence: Aligned Edge And Expected Value V1

Status: Implemented and validated locally. Production deployment remains pending explicit authorization.

Evidence: `src/services/market-alignment.service.ts`, `src/services/current-board.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/dashboard-today.service.ts`, `src/components/dashboard/UserTodayPanel.tsx` and `/api/operations/validation`.

Note: Phase 2 adds an auditable `market_alignment_v1` contract for exact model-versus-market comparison. Current Board candidates now expose alignment status, selected odds snapshot ID, sportsbook, model probability, implied probability, edge in percentage points, expected value percent, selected market freshness, provider/source timestamp, ingestion timestamp and risk. Best Value excludes unaligned, missing-price, missing-probability and stale market inputs. User Mode displays aligned probability, implied probability, edge, EV, confidence, risk and market age without changing prediction formulas, recommendation categories, Official Pick thresholds, Current Board generation policy, settlement, learning or supported markets. Phase 3 has not started.

### MLB Odds Freshness Timestamp Certification V1

Status: Implemented locally before Phase 2. Production deployment and post-deploy read-only smoke remain required.

Evidence: `src/services/current-board.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/operations-health.service.ts`, `src/services/dashboard-today.service.ts`, `src/components/dashboard/UserTodayPanel.tsx` and `src/components/dashboard/ProductTodayPanel.tsx`.

Note: The real 2026-07-20 21:45Z production refresh inserted the visible odds rows, but Market Prices freshness used provider/source `snapshot_time` instead of the exact persisted visible snapshot lineage. Current Board now separates provider source timestamp from selected market input freshness, uses the persisted selected snapshot ingestion timestamp for user-facing freshness when source time is not reliable, and reports visible fresh/stale counts for mixed coverage. Prediction formulas, recommendation thresholds, candidate ordering, Current Board generation policy, settlement, learning and unsupported markets remain unchanged. Phase 2 has not started.

### Scheduler Reliability Hardening V1

Status: Implemented locally before Phase 2. Production deployment and natural scheduled-run validation remain required.

Evidence: `.github/workflows/production-operating-day.yml`, `.github/workflows/production-operating-day-heartbeat.yml`, `src/services/operations-health.service.ts`, `src/components/dashboard/OperationsHealthPanel.tsx` and `docs/SCHEDULER_RELIABILITY.md`.

Note: The primary GitHub Actions scheduler avoids common quarter-hour congestion by running at `7,22,37,52 * * * *`. A heartbeat workflow runs at `14,44 * * * *` and calls the same protected operating-day endpoint with the same concurrency group; Adaptive Refresh, provider budget and execution locks remain the single control plane. Operations Health now reports missed scheduler intervals and late/critical cadence state. No prediction logic, recommendation logic, odds freshness semantics, Current Board generation, settlement logic or provider clients changed.

### Production Refresh Infrastructure V1

Status: Implemented locally before Phase 2. Production deployment and scheduler proof remain required.

Evidence: `src/app/api/cron/operating-day/route.ts`, `src/services/adaptive-refresh-orchestrator.service.ts`, `src/services/operations-health.service.ts`, `src/components/dashboard/OperationsHealthPanel.tsx`, `.github/workflows/production-operating-day.yml`, `.github/workflows/operating-day-refresh.yml`, `docs/PRODUCTION_REFRESH_INFRASTRUCTURE.md` and `docs/SCHEDULER_RELIABILITY.md`.

Note: The production cron entrypoint now delegates to the existing Adaptive Refresh bridge before any legacy automation short-circuit. This lets stale market prices select budget-guarded `midday_refresh` instead of returning `already_current` while the dashboard stays stale. Adaptive Refresh exposes event-level refresh windows and Operations Health exposes scheduler, provider budget, last refresh, next due, skipped-call and refresh-window evidence. Advanced Status renders the provider/scheduler fields from the existing health API, and the legacy operating-day workflow is manual-only so unattended execution has one scheduler of record. Prediction logic, recommendation logic, Current Board generation and settlement logic remain unchanged.

### MLB User Mode Freshness And Provider Budget Phase 1

Status: Implemented locally. Phase 2 has not started.

Evidence: `src/services/provider-budget.service.ts`, `src/services/adaptive-refresh-orchestrator.service.ts`, `src/services/operations-health.service.ts`, `docs/MLB_USER_MODE_FRESHNESS_PROVIDER_BUDGET_PHASE_1.md`, `docs/PROVIDER_BUDGET_POLICY.md`, `docs/PROVIDER_BUDGET_REFRESH_STRATEGY.md` and `docs/SCHEDULER_RELIABILITY.md`.

Note: This phase fixes freshness and budget truth without changing prediction formulas, Current Board generation, recommendation policy, settlement, learning or supported markets. The adaptive orchestrator now applies configurable MLB operating-window freshness thresholds and exposes the active policy. Provider Budget now supports MLB/global budget aliases, a bounded 1500-call default, soft reserve, per-action cap, rolling-hour cap, warning threshold and hard-stop threshold. The observed 267-minute market/prediction/recommendation freshness was caused by loose adaptive odds thresholds plus once-daily Vercel cron without proven intraday external scheduler activation. Confirmed lineups remain unsupported and are not polled.

### MLB Core V1 Runtime Certification Until Pass

Status: Certified locally. Production deployment and unattended external scheduler verification remain pending.

Evidence: `src/services/provider-time-normalization.service.ts`, `src/services/mlb-game-lifecycle.service.ts`, `src/services/mlb-temporal-health.service.ts`, `src/services/operating-day-automation.service.ts`, `src/services/adaptive-refresh-orchestrator.service.ts`, `src/services/current-board.service.ts`, `src/services/dashboard-today.service.ts`, `docs/MLB_OPERATING_DAY_RUNTIME_CERTIFICATION.md`, `docs/CORE_V1_CERTIFICATION.md` and `docs/MLB_TODAY_PAGE_END_TO_END_DATA_VISIBILITY_RUNTIME_ALIGNMENT_REPAIR_V1.md`.

Note: Protected local runtime execution against real providers selected the current actionable MLB slate `2026-07-20`, not stale recovery `2026-07-18`. Status refresh completed with MLB Stats API evidence; odds refresh completed with SportsDataIO `GameOddsByDate` evidence and 90 inserted odds snapshots. Today then returned `AVAILABLE` with 15 visible current-day cards, 24 Current Board candidates, 10 Most Likely rows, positive-only Best Value empty state, 0 provider calls and 0 mutations in 1996ms. Production remains pending deployment of the local commit and external scheduler proof; no model, threshold, champion/V7, settlement, learning or unsupported-market behavior changed.

### MLB Today Page End-to-End Data Visibility & Runtime Alignment Repair V1

Status: Certified locally. Deployment was explicitly not authorized for this mission.

Evidence: `src/app/api/dashboard/today/route.ts`, `src/app/api/dashboard/route.ts`, `src/app/dashboard/page.tsx`, `src/components/dashboard/UserTodayPanel.tsx`, `src/components/dashboard/ProductTodayPanel.tsx`, `src/services/dashboard-today.service.ts`, `src/services/mlb-operating-date-resolution.service.ts`, `src/services/adaptive-refresh-orchestrator.service.ts` and `docs/MLB_TODAY_PAGE_END_TO_END_DATA_VISIBILITY_RUNTIME_ALIGNMENT_REPAIR_V1.md`.

Note: The Today UI now uses the canonical no-store `/api/dashboard/today` route and refreshes from stored state without provider calls or mutations. Market-facing adaptive actions select the current or next actionable slate instead of bounded stale recovery dates; status/results recovery remains preserved. Local runtime validation now returns all 15 current-day MLB cards and stored board-derived sections; production validation remains pending deployment.

### MLB sport_events.status Constraint Root Cause Trace V1

Status: Implemented locally. Production deployment and protected smoke validation remain required.

Evidence: `src/services/mlb-event-status-mapper.service.ts`, `src/services/operating-day.service.ts`, `src/services/results-sync.service.ts`, `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/services/nba-data-sync.service.ts`, `src/services/basketball/acquisition/bsn-acquisition-engine.ts` and `docs/MLB_SPORT_EVENTS_STATUS_CONSTRAINT_ROOT_CAUSE_TRACE_V1.md`.

Note: Local runtime validation proved the exact invalid legacy attempted DB value as `final` from MLB Stats API `Final` in `refreshMlbGameStatuses`; `final` is not allowed by `sport_events_status_check`, and canonical DB status is `completed`. Every discovered `sport_events.status` writer now calls the shared status write guard before persistence. No prediction, recommendation, EV, Kelly, confidence, scheduler, provider-budget, dashboard or temporal architecture changes were made.

### MLB Canonical Event Status, Stale Slate Recovery & Temporal Truth Repair V1

Status: Implemented locally. Production deployment and protected smoke validation remain required.

Evidence: `src/services/mlb-event-status-mapper.service.ts`, `src/services/operating-day.service.ts`, `src/services/results-sync.service.ts`, `src/services/mlb-operating-date-resolution.service.ts`, `src/services/provider-time-normalization.service.ts`, `src/services/mlb-game-lifecycle.service.ts`, `src/services/dashboard-today.service.ts` and `docs/MLB_CANONICAL_EVENT_STATUS_STALE_SLATE_TEMPORAL_REPAIR_V1.md`.

Note: Repairs the production HTTP 207 status-refresh blocker by ensuring MLB Stats API provider statuses are mapped to the existing `sport_events.status` constraint before persistence. Prior unresolved slates are only actionable inside a 2-day recovery window; older residual rows are stale-orphan diagnostics. Legacy SportsDataIO MLB start times can be repaired using metadata or `provider_ids`, and game cards expose temporal diagnostics. No scheduler redesign, dashboard redesign, prediction formula, Official policy, Champion/V7, settlement or learning changes were made.

### MLB Operating Day Runtime Certification V1

Status: Implemented with blockers. Runtime certification remains FAIL until production deployment/smoke, external scheduler activation verification and MLB Stats API results sync are completed.

Evidence: `src/services/operating-day.service.ts`, `src/services/operating-day-automation.service.ts`, `src/services/adaptive-refresh-orchestrator.service.ts`, `src/app/api/cron/operating-day/route.ts`, `docs/MLB_OPERATING_DAY_RUNTIME_CERTIFICATION.md`, `docs/OPERATIONS_RUNBOOK.md`, `docs/SCHEDULER_RELIABILITY.md` and `docs/PRODUCTION_OPERATIONS_PIPELINE.md`.

Note: This mission does not redesign User Mode or change model/recommendation standards. It adds protected MLB Stats API status refresh, MLB Stats API canonical results sync, corrected market-due logic and a production scheduler workflow through the existing operating-day/adaptive execution bridge. Full runtime certification remains blocked because the authorized production Vercel deploy was rejected by the execution environment before deployment ID or smoke evidence could be produced.

## MLB Operating Date Consistency, Action Advancement & Dashboard Query Reliability V1

Status: Implemented locally

Note: Adds a canonical MLB operating-date resolver, action advancement after successful `SUCCESS_NO_CHANGE` status provider checks, lifecycle-ledger-backed health evidence and Today fallback states for query timeout/failure. It does not change dashboard design, prediction formulas, Official policy, settlement, learning, Champion/V7 or unsupported-market gates.

### MLB Slate Recovery & Lifecycle Truth Repair V1

Status: Implemented locally. Deployment and production smoke validation remain required.

Evidence: `src/services/dashboard-today.service.ts`, `src/services/mlb-game-lifecycle.service.ts`, `src/services/operations-health.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `src/app/api/dashboard/route.ts` and `docs/MLB_SLATE_RECOVERY_LIFECYCLE_TRUTH_REPAIR.md`.

Note: This focused production regression repair separates slate membership from lifecycle certainty and betting eligibility. The Today aggregator now uses a widened stored-event query and canonical Puerto Rico operating-date filtering after MLB time normalization, keeps stale-status games visible, returns lifecycle/betting counts and slate diagnostics, and preserves User Mode cards when optional intelligence sections fail. Passed-start stale games are visible as status-update-overdue and betting locked; future stale games are scheduled/data-aging. Operations health now exposes status-refresh evidence and reports `MISSED_REFRESH` when a protected MLB Stats API status check is due but not executed. Prediction formulas, projection formulas, Official Pick thresholds, champion rows, V7, settlement, learning and unsupported market gates are unchanged.

### MLB Production Certification & Closed Beta Audit V1

Status: Implemented locally. Public production certification remains blocked until deployment and production smoke validation are completed.

Evidence: `src/services/mlb-game-lifecycle.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/dashboard-today.service.ts`, `src/services/ai-bet-finder.service.ts`, `src/services/market-intelligence-engine.service.ts`, `src/services/autonomous-daily-operations.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `src/app/api/dashboard/route.ts` and `docs/MLB_PRODUCTION_CERTIFICATION_CLOSED_BETA_AUDIT.md`.

Note: This is a certification repair pass, not a feature or architecture sprint. Stale `Scheduled`/`Pregame` MLB provider statuses after first pitch now resolve to status-unconfirmed instead of rendering as Pregame, user-facing Best Value surfaces now return only positive EV plus positive edge candidates and show `No positive-value opportunities today.` when empty, the standalone Best Value page no longer exposes pass rows under the Best Value label, and the dashboard route preserves separate Today and legacy error contracts. Prediction formulas, projection integrity, Official Pick thresholds, champion rows, V7, settlement, learning, provider adapters and unsupported market gates are unchanged.

### Today Dashboard Load Reliability Repair V1

Status: Implemented pending deployment and production validation.

Evidence: `src/services/dashboard-today.service.ts`, `src/app/api/dashboard/route.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `docs/TODAY_DASHBOARD_RELIABILITY.md`, `docs/AI_EXPERIENCE_CLOSED_BETA_UX.md` and `docs/CLOSED_BETA_READINESS.md`.

Note: This is a focused reliability repair. It does not add product features or change prediction/projection logic. The Today endpoint now has a stable typed envelope, bounded parallel dependency reads, independent optional sections, timing diagnostics and zero provider-call/zero-mutation page-load behavior. The client no longer blanks User Mode because Most Likely, Best Value or AI Bet Finder is temporarily unavailable. Local degraded validation improved from about 42.8s before the repair to about 1.8s server timing after the repair.

### MLB Odds Refresh Execution Repair V1

Status: Implemented pending build and controlled production validation.

Evidence: `src/services/adaptive-refresh-orchestrator.service.ts`, `src/services/operating-day.service.ts`, `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `/api/operations/adaptive-refresh`, `docs/MLB_ODDS_REFRESH_EXECUTION.md`, `docs/ADAPTIVE_REFRESH_EXECUTION.md`, `docs/PRODUCTION_OPERATIONS_PIPELINE.md`, `docs/SCHEDULER_RELIABILITY.md` and `docs/OPERATIONS_RUNBOOK.md`.

Note: This is a focused production defect repair, not new architecture. Due provider-backed `midday_refresh` work now remains provider-backed through Adaptive Refresh, Operating Day and SportsDataIO MLB odds capture. The existing preview service bypasses only the stale odds checkpoint when forced by legitimate due work, performs the canonical SportsDataIO `GameOddsByDate` check, persists accepted snapshots, blocks older provider responses from superseding newer odds and reports explicit provider-check evidence. `SUCCESS_NO_CHANGE` requires `providerCheckCompleted=true`; skipped provider work remains `MISSED_REFRESH`. Prediction formulas, official thresholds, Current Board policy, champion rows, V7, Projection Integrity, settlement and learning are unchanged.

### AI Experience & Closed Beta User Experience V1

Status: Completed pending production smoke validation.

Evidence: `src/components/dashboard/UserTodayPanel.tsx`, `src/components/dashboard/MlbProjectionBoardClient.tsx`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/ai-bet-finder`, `docs/AI_EXPERIENCE_CLOSED_BETA_UX.md`.

Note: This sprint surfaces existing intelligence rather than adding engines. User Mode now shows Today's Story, Most Likely probability rankings, Best Value rankings, AI Lean/Watchlist/Avoid explanations, richer game cards, truthful freshness/system-health language and educational empty states. Most Likely remains probability-only and informational. Best Value remains value-ranked and informational unless Official Pick policy qualifies it. Projection Board explains blocked state without relaxing Projection Integrity. Prediction formulas, projection formulas, Official Pick thresholds, champion rows, V7, settlement, learning, Temporal Truth, provider integrations and Current Board policy remain unchanged.

### Production Stabilization & Closed Beta Readiness V1

Status: Completed pending production smoke validation.

Evidence: `src/services/adaptive-refresh-orchestrator.service.ts`, `src/services/operations-health.service.ts`, `src/services/universal-projection-engine.service.ts`, `src/components/dashboard/UserTodayPanel.tsx`, `/api/operations/health`, `/api/operations/adaptive-refresh`, `docs/CLOSED_BETA_READINESS.md`.

Note: This stabilization pass does not add a new architecture. It tightens the existing adaptive refresh, operations health, projection integrity diagnostics and User Mode truthfulness. Provider-backed due refreshes can no longer be hidden behind `SUCCESS_NO_CHANGE` when no provider check occurred; those executions return `MISSED_REFRESH`. Operations Health now separates platform, provider, projection and prediction health. Projection Health explains why rows remain blocked without relaxing integrity gates. User Mode replaces vague `Ready` wording with `Healthy`, `Limited`, `Data Aging`, `Waiting for Provider` and `Operational Blocker` states. Prediction formulas, projection formulas, Official Pick thresholds, Current Board policy, champion rows, V7, settlement, learning, Temporal Truth and provider integrations remain unchanged.

### MLB Projection Integrity, Player Resolution, Historical Activation & User Projection Board V1

Status: Completed pending final deployment validation.

Evidence: `src/services/mlb-projection-integrity.service.ts`, `src/services/universal-projection-engine.service.ts`, `/api/mlb/projections/health`, `/projections`, additive projection-history migration updates and projection integrity docs.

Note: This module keeps projections shadow-only and sportsbook-independent while correcting integrity defects. Projection IDs now include model/version/entity/event context, pitcher projections require event starter resolution, league-baseline team rows are blocked from user ranking, missing values remain missing, unit/plausibility checks gate output, and the Projection Board sorts by rank score rather than projected quantity. Provider calls, betting formulas, official thresholds, Current Board policy, champion/V7 state, betting settlement, learning and provider-budget policy remain unchanged.

### MLB Temporal Truth, Game Status & Freshness Reliability V1

Status: Completed pending final build/deployment verification.

Evidence: `src/services/provider-time-normalization.service.ts`, `src/services/mlb-game-lifecycle.service.ts`, `src/services/mlb-freshness-policy.service.ts`, `src/services/mlb-temporal-health.service.ts`, `/api/mlb/temporal-health`, `src/components/dashboard/MlbTemporalHealthPanel.tsx`, Current Board/next-slate/dashboard/projection integration and temporal docs.

Note: This module fixes the production class of defects where SportsDataIO MLB Eastern-local start times were treated as UTC and displayed hours early. SportsDataIO MLB naive `DateTime` fields now normalize through `America/New_York`, API timestamps remain explicit UTC instants, UI rendering is display-only, and legacy SportsDataIO rows are repaired on read without rewriting history. Lifecycle and betting eligibility are separated; time-only fallback cannot claim `LIVE`, `FINAL`, `POSTPONED` or `CANCELED`. Provider calls, prediction mutations, remote mutations, formulas, model weights, official thresholds, Current Board policy, champion/V7 state, settlement, learning and provider quota policy remain unchanged.

### MLB Universal Projection Engine V1

Status: Completed pending build/deployment verification.

Evidence: `src/services/universal-projection-engine.service.ts`, `/api/projections`, `/api/mlb/projections`, `src/components/dashboard/UniversalProjectionEnginePanel.tsx`, `supabase/migrations/202607190002_universal_projection_history_v1.sql`, AI Brain projection-health integration and projection docs.

Note: This module creates the sportsbook-independent projection foundation for future market expansion. It produces statistical projections only and does not generate betting recommendations, Official Picks, EV, Kelly or sportsbook-line comparisons. Projection history is separate from betting prediction history. Existing prediction formulas, Current Board, official thresholds, champion/V7 state, settlement, learning and provider logic are unchanged.

### MLB Market Expansion Program V1

Status: Completed pending build/deployment verification.

Evidence: `docs/MLB_MARKET_EXPANSION_PROGRAM.md`, `src/services/mlb-market-expansion-roadmap.service.ts`, `/api/mlb/markets/expansion-roadmap`, and the AI Brain engineering advisor in `src/services/ai-performance-center.service.ts`.

Note: This module makes Team Totals V1 the official Wave 1 MLB market expansion target using a weighted per-market readiness matrix and implementation-wave plan. It is an advisory/program layer only. No market was implemented, no provider data was acquired, and prediction formulas, official thresholds, Current Board, champion/V7 status, settlement, learning, provider logic and historical rows remain unchanged.

### MLB Market Expansion Roadmap & Implementation Plan V1

Status: Completed pending build/deployment verification.

Evidence: `src/services/mlb-market-expansion-roadmap.service.ts`, `/api/mlb/markets/expansion-roadmap`, `src/components/dashboard/MlbMarketExpansionRoadmapPanel.tsx`, `docs/MLB_MARKET_EXPANSION_ROADMAP.md`, `docs/MLB_MARKET_TAXONOMY.md`, `docs/MLB_MARKET_PROVIDER_MATRIX.md`, `docs/MLB_MARKET_DATA_REQUIREMENTS.md`, `docs/MLB_MARKET_MODEL_REQUIREMENTS.md`, `docs/MLB_MARKET_SETTLEMENT_REQUIREMENTS.md`, `docs/MLB_MARKET_ACTIVATION_GATES.md` and `docs/MLB_MARKET_RISK_ANALYSIS.md`.

Note: This module is roadmap and planning only. It verifies the current MLB market baseline from existing production contracts, defines a canonical expansion taxonomy, provider/data/model/settlement/historical matrices, user-value ranking, opportunity estimates, risk grades, weighted prioritization, implementation waves and activation gates. The recommended first implementation epic is Team Totals V1 as shadow-only, not official-pick eligible, pending verified team-total odds, historical line snapshots and deterministic settlement. No provider acquisition, prediction formula, model weight, threshold, champion/challenger/V7, Current Board, settlement, learning, historical-row or betting-activation behavior changed.

### Production Readiness Audit V1

Status: Completed and build verified.

Evidence: `src/services/production-readiness-audit.service.ts`, `/api/production-readiness/audit`, `src/components/dashboard/ProductionReadinessAuditPanel.tsx`, `docs/PRODUCTION_READINESS_AUDIT.md`.

Note: This module creates the final read-only certification layer for Beta readiness. It does not introduce new scoring engines or parallel architecture; it composes existing AIPEC/AI Brain, Current Board, Adaptive Operations, Top Picks and MLB market capability contracts. It reports platform scores, Current Board universe vs candidates, market support, official-pick blockers in plain English, data availability, freshness, scheduler/provider state and guardrails. Certification is public production `NO`, closed beta `YES` with remaining blockers for mature calibration/historical odds, player availability/lineup depth and high-frequency fresh odds cadence. No prediction, threshold, champion, V7, provider, settlement, learning or historical-row behavior changed.

### Live Data Freshness & Adaptive Operations V1

Status: Completed pending build/deployment verification.

Evidence: `src/services/adaptive-refresh-orchestrator.service.ts`, `/api/operations/status`, `/api/operations/adaptive-refresh`, `/api/operations/adaptive-refresh/status`, `/api/operations/data-freshness`, `/api/operations/change-events`, `/api/operations/refresh-plan`, `/api/operations/provider-budget-forecast`, `/api/operations/validation`, `src/components/dashboard/AdaptiveOperationsPanel.tsx`, `src/components/dashboard/DataFreshnessPreviewCard.tsx` and adaptive operations docs.

Note: This module adds a decision/reporting layer over existing operations rather than a second scheduler. It audits the configured Vercel cron, normalizes freshness domains, forecasts provider-budget mode and refresh work, exposes plan-only dry runs, and keeps stale odds from being treated as actionable. Recommendation-change events are typed empty until persistent event storage is introduced. Provider calls, prediction mutations, remote mutations from status reads, thresholds, champion/challenger/V7 state, Current Board policy, settlement, learning and historical records remain unchanged.

### MLB Production Certification V1

Status: Completed and build verified.

Evidence: `docs/MLB_PRODUCTION_CERTIFICATION.md`, `docs/MLB_ARCHITECTURE.md`, `docs/MLB_OPERATIONS.md`, `docs/MLB_PROVIDER_STRATEGY.md`, `docs/MLB_AUTOMATION.md`, `docs/MLB_DATA_FLOW.md`, `docs/MLB_FEATURES.md`, `docs/MLB_LIMITATIONS.md`, `docs/MLB_KNOWN_ISSUES.md`, `docs/MLB_RELEASE_NOTES.md` and production validation of MLB read/status routes.

Note: MLB is certified as Production Stable and moved to Maintenance Mode for version `v1.0.0`. Architecture, models, dashboard architecture, automation lifecycle, recommendation policy, official-pick thresholds, champion row policy, settlement policy, learning policy and provider-budget strategy are frozen. No code feature changes, model changes, threshold changes, provider logic changes, settlement changes, learning changes, Champion promotion or V7 promotion were introduced. Future MLB work is limited to bug fixes, provider upgrades, UI polish, performance improvements, security updates and documentation refreshes. Primary roadmap priority now transitions to BSN and basketball intelligence.

### BSN Intelligence Engine V1

Status: Completed and build verified.

Evidence: `src/services/bsn-intelligence-engine.service.ts`, `/api/bsn/intelligence`, `/api/bsn/team/[id]`, `/api/bsn/compare`, `/api/bsn/power-rankings`, `/api/bsn/momentum`, `/api/bsn/features` and `src/components/dashboard/BsnIntelligencePanel.tsx`.

Note: This module turns stored BSN data into reusable basketball intelligence without enabling betting predictions. It derives team profiles, player profiles, standings context, recent form, momentum, consistency, strength, power rankings, comparison advantages, league knowledge and computed BSN feature records only from validated normalized rows. Missing player game logs, historical baselines, durable feature-store persistence, odds and prediction-ready inputs stay unavailable rather than estimated. It reuses the Basketball Data Platform, Historical Builder, Historical Import Engine contracts, Feature Store Core, Shared Prediction SDK, Provider Registry and validation patterns. No provider calls, writes, Current Board changes, official-pick changes, thresholds, champion rows, V7 promotion, settlement, learning or MLB behavior changed.

### BSN Prediction Engine V1

Status: Completed and build verified.

Evidence: `src/services/bsn-shadow-prediction-engine.service.ts`, `/api/bsn/predictions`, `/api/bsn/predictions/preview`, `/api/bsn/predictions/validation`, `/api/bsn/game/[id]`, `src/components/dashboard/BsnPredictionPreviewPanel.tsx` and `docs/bsn-prediction-engine-v1.md`.

Note: This module adds probability-only BSN game predictions in shadow mode. It reuses BSN Intelligence, the Basketball Platform, Historical Builder, Feature Store Core and Shared Prediction SDK compatibility metadata without calling the SDK EV/Kelly recommendation builder. Outputs are limited to home win probability, away win probability, confidence, data quality, prediction quality and reasoning. Missing data remains unavailable, and empty upcoming schedules return typed empty previews. Official Picks, Current Board activation, EV/value, Bet Slip, AI Leans, Watchlist, Avoid, champion rows, thresholds, V7 promotion, settlement, learning, MLB behavior, provider calls and remote mutations are unchanged.

### BSN Model Maturity Mission V1

Status: Completed and build verified.

Evidence: `src/services/bsn-model-maturity.service.ts`, `/api/bsn/model-maturity`, phase-specific maturity API routes, `src/components/dashboard/BsnModelMaturityPanel.tsx` and `docs/bsn-model-maturity-v1.md`.

Note: This module adds BSN backtesting, calibration, a performance center, explanation quality checks, readiness scoring, shadow market intelligence and an activation audit without enabling betting. It reuses the existing BSN Shadow Prediction Engine for replay math and keeps outputs probability/science-only. The current audit recommends Continue Shadow because the sample is not large enough for official activation, verified odds are missing, immutable pregame feature snapshots are not persisted, and player availability/boxscore depth remain unavailable. Provider calls, remote mutations, Official Picks, Current Board, EV/value/Kelly, AI Leans, Watchlist, Bet Slip, champion rows, thresholds, V7 promotion, settlement, learning and MLB behavior are unchanged.

### Universal AI Performance & Evolution Center V1

Status: Completed and build verified.

Evidence: `src/services/ai-performance-center.service.ts`, `/api/ai-performance-center`, `/api/ai-performance-center/daily-update`, `src/components/dashboard/AiPerformanceCenterPanel.tsx` and `docs/ai-performance-center-v1.md`.

Note: This module creates one read-only AI performance center for every enabled sport. It uses the existing sport registry for automatic future-sport discovery, stored `prediction_history` for settled/persisted rows, BSN shadow replay for shadow-only maturity evidence, the Feature Store, Prediction SDK, calibration service and Current Board status. It reports universal history, report cards, trend analysis, model evolution, performance timeline, confidence analysis and readiness without creating recommendations or changing any prediction, settlement, learning, threshold, champion, Current Board, Bet Slip, provider or V7 behavior.

### Pick Analyzer AI Brain & Trust System V1

Status: Completed and build verified.

Evidence: `src/services/ai-performance-center.service.ts`, `/api/performance`, `/api/performance/sports`, `/api/performance/[sport]`, `/api/performance/history`, `/api/performance/evolution`, `/api/performance/report-card`, `/api/performance/trust`, `/api/performance/goals`, `/api/performance/readiness`, `/api/performance/validation`, `/api/performance/daily-update`, `/performance`, `src/components/performance/PerformanceClient.tsx`, `supabase/migrations/202607190001_ai_performance_snapshots_v1.sql` and AI Brain documentation.

Note: This module extends AIPEC rather than creating parallel metrics infrastructure. It adds AI Brain contracts, AI Trust Score V1, trust-change explanations, AI evolution comparisons, optional idempotent daily snapshots, Daily AI Report Card V1, goals/progress, maturity pipelines, public and internal performance views, universal prediction-history filtering and registry-driven future-sport integration. The snapshot migration is additive and does not rewrite prediction history. Provider calls, external acquisition, prediction model changes, official thresholds, Current Board policy, Official Picks, AI Lean/Watchlist/Avoid policy, Bet Slip/Kelly, settlement, learning mutations, champion/challenger/shadow status and V7 status remain unchanged.

### AI Performance Center Product UI V1

Status: Completed and build verified.

Evidence: `/performance`, `src/components/performance/PerformanceProductClient.tsx`, `src/components/dashboard/AiPerformancePreviewCard.tsx`, dashboard navigation updates, `/api/performance` contract exposure and UI docs.

Note: This is a product UI and contract-integration sprint on top of the existing AI Brain. It adds first-class navigation, dashboard discoverability, sport filtering, All Sports and sport-specific summaries, Trust Score and component display, Daily Report Card, stored-snapshot evolution state, model maturity, goals, prediction-history filtering and detail inspection, timeline summaries, engineering recommendations and collapsed internal diagnostics. It reuses existing metrics and APIs, does not duplicate engines, and does not modify prediction formulas, trust formulas, report-card formulas, readiness formulas, thresholds, champion/challenger/shadow state, V7, Current Board, Official Picks, settlement, learning, provider acquisition or historical rows.

### Premium AI Sports Intelligence Product Experience V1

Status: Completed and build verified.

Evidence: `src/components/dashboard/UserTodayPanel.tsx`, `src/components/dashboard/DashboardDeveloperGroups.tsx`, `/dashboard`.

Note: This is a presentation-only dashboard sprint. User Mode now opens with the betting decision first, followed by Market Mood, Updated time, Official Picks, Games Today and a primary View Opportunities action. Category cards, Top AI Opportunity, AI Confidence, Today's Games, Today at a Glance and System Health were simplified into premium, scan-first cards using only existing response fields. Requested explanatory copy and legacy labels were removed from the primary experience. Advanced Details remain grouped under Overview, Markets, Model, Historical, Data, Provider, Settlement, Learning, Calibration and Administration. No models, thresholds, champion rows, V7 promotion, provider behavior, Current Board logic, settlement, learning or database writes changed.

### BSN Data Completion Mission V1

Status: Completed with public-source limitations and build verified.

Evidence: `src/services/basketball/connectors/official-bsn-homepage.connector.ts`, `src/services/basketball/acquisition/bsn-acquisition-engine.ts`, `/api/basketball/bsn/acquisition`, `/api/basketball/bsn/data-coverage`, `src/components/dashboard/BasketballDataCoveragePanel.tsx`.

Note: The existing official BSN connector was deepened in place. It now discovers and acquires all supported data exposed by bounded public official pages: teams, standings, recent completed results, player-list sample and limited team leaders. It adds cache, retry, checkpoint/resume metadata, rate spacing, connector health and typed unavailable responses. Historical reconstruction continues for 2026 while real public data exists and stops for prior seasons without a permissioned archive. Knowledge/Feature Store handoff remains limited to what completed games can support; no fabricated quarter scores, boxscores, play-by-play, odds, officials, attendance or advanced metrics were introduced. No prediction model, provider policy, recommendation threshold, champion/challenger row, V7 promotion, settlement, learning or calibration behavior changed.

### Product Polish and Visual Dashboard V2

Status: Completed and build verified.

Evidence: `src/components/dashboard/UserTodayPanel.tsx`, `src/components/dashboard/DashboardDeveloperGroups.tsx`, `/dashboard`.

Note: User Mode was redesigned around one fast visual read: AI Market Outlook, deterministic market sentiment, four category infographic cards, Top AI Opportunity progress meters, compact game cards, Today at a Glance readiness states and one System Health card. Market sentiment mapping is display-only: Official Picks -> AGGRESSIVE, AI Leans/ready analysis -> SELECTIVE, waiting odds/empty freshness -> WAITING, otherwise DEFENSIVE. Advanced Details are now one dashboard area with collapsible Overview, Markets, Model, Historical Performance, Data, Provider, Settlement, Learning, Calibration and Administration groups. Main User Mode still fetches the existing Today and Most Likely contracts only; advanced panels remain lazy/collapsed. No model, provider, recommendation, settlement, learning, threshold, champion/challenger, V7 or data-mutation behavior changed.

### BSN Acquisition Engine V1

Status: Completed and build verified.

Evidence: `src/services/basketball/connectors/official-bsn-homepage.connector.ts`, `src/services/basketball/acquisition/bsn-acquisition-engine.ts`, `/api/basketball/bsn/acquisition`, `sports_teams`, `sport_standings`, `provider_entity_mappings` and `sports_sync_jobs`.

Note: The first real BSN connector uses a single cached official homepage standings snapshot. It supports only teams and standings, imports only a small standings sample when explicitly confirmed, preserves source URL/fetched timestamp/provider IDs/canonical IDs, and keeps schedule, results, game IDs, players, statistics, boxscores, play-by-play, officials, attendance, arena, advanced metrics and odds typed as unavailable. Current Board and official-pick impact remain none because no events, verified odds, feature snapshots, predictions or recommendation-policy outputs are created.

### Professional AI Sports Intelligence Dashboard UX V1

Status: Completed and build verified.

Evidence: `src/components/dashboard/UserTodayPanel.tsx`, `src/app/dashboard/page.tsx`, `src/components/dashboard/DashboardDeveloperGroups.tsx`, `src/components/dashboard/DeveloperDetails.tsx`, `src/components/dashboard/DashboardShell.tsx`.

Note: The default dashboard now separates User Mode from Advanced Details. User Mode emphasizes a 10-second betting decision, Official Picks, AI Leans, Watchlist, Avoid, top AI opportunity, simplified games, progress indicators and a simple system health state. Technical panels remain available behind collapsed Advanced Details sections. This was presentation-only: no prediction models, thresholds, settlement, learning, AI calculations, champion rows or provider behavior were changed.

### BSN Historical Reconstruction V1

Status: Completed and build verified.

Evidence: `src/services/basketball/history/bsn-historical-reconstruction.ts`, `/api/basketball/bsn/historical-reconstruction`, `src/services/basketball/history/historical-builder.ts`, `src/services/basketball-source-framework.service.ts`, `src/services/bsn-platform.service.ts`, `scripts/basketball-cli.js`.

Note: This module uses the Basketball Data Platform rather than creating another platform or import engine. It discovers BSN connector capabilities, inventories seasons from existing normalized and legacy storage, composes the Historical Builder workflow, and reports reconstruction, coverage, missing datasets, validation, Feature Store and Prediction SDK compatibility. No provider calls, writes, scraping, fabricated values, official-pick changes, champion mutation, threshold changes, settlement changes or learning changes were introduced.

### Basketball Data Platform V1

Status: Completed and build verified.

Evidence: `src/services/basketball/`, `/api/basketball/platform`, `scripts/basketball-cli.js`, `package.json`, `src/services/basketball-source-framework.service.ts`, `src/services/historical-import-engine.service.ts`, `src/services/feature-store-core.service.ts` and `src/services/sport-prediction-engine-sdk.service.ts`.

Note: This is the generic basketball data infrastructure layer for BSN and future basketball leagues, not a scraper and not a one-off importer. It defines connector-first acquisition contracts, typed unsupported capability behavior, canonical basketball entities with stable IDs, normalization, data quality, reconciliation, historical builder checkpoints, knowledge generation plans, Feature Store handoffs, Prediction SDK handoffs, CLI entry points and deterministic validation. Existing Pick Analyzer services remain the system of record for provider registry, historical import, Feature Store and prediction output. No provider calls, writes, official-pick changes, champion mutation, threshold changes, settlement changes or learning changes were introduced.

### AI Market Intelligence Category Expansion V1

Status: Completed and build verified.

Evidence: `src/services/market-intelligence-category.service.ts`, `src/services/dashboard-today.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/ai-bet-finder.service.ts`, `src/services/market-intelligence-engine.service.ts`, `src/services/best-bets-today.service.ts`, `src/components/dashboard/ProductTodayPanel.tsx`, `src/components/dashboard/MarketIntelligenceSummaryPanel.tsx`, `src/components/dashboard/TopPicksPanel.tsx`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `src/components/market-opportunities/AiBetFinderTool.tsx` and `src/components/market-opportunities/BettingWorkbenchTool.tsx`.

Note: Stored Current Board candidates now drive four independent product categories: Official, AI Lean, Watchlist and Avoid. Non-official rows are ranked as market intelligence only, include required caution copy and reason-not-official explanations, and remain excluded from official recommendation/performance semantics. Category counters and empty independent track-record contracts are exposed without settlement-policy changes. No prediction model, V7/champion state, threshold, settlement or learning behavior was changed.

### Official Vs Informational Ranking Separation V1

Status: Completed and build verified.

Evidence: `src/services/market-opportunity-suite.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/ai-bet-finder.service.ts`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `src/components/market-opportunities/AiBetFinderTool.tsx`, `src/components/market-opportunities/BettingWorkbenchTool.tsx` and `src/components/dashboard/TopPicksPanel.tsx`.

Note: Most Likely, Best Value, AI Bet Finder and Betting Workbench now continue to provide display-only informational rankings when the strict Current Board has no official/current rows but stored current-day candidates exist. Labels are mutually exclusive across Official Recommendation, Informational Only and Avoid, non-official opportunities include the required warning and reason-not-official explanation, and official-pick columns clarify that empty official recommendations are not empty informational analysis. Prediction models, V7, champion rows, official thresholds, settlement, learning and confidence calculations remain unchanged.

### Dashboard Unification, Performance And Slate Consistency V1

Status: Completed and build verified.

Evidence: `src/services/dashboard-today.service.ts`, `/api/dashboard?mode=today`, `src/components/dashboard/ProductTodayPanel.tsx`, `src/components/dashboard/DashboardDeveloperGroups.tsx`.

Note: The dashboard now has one canonical Today contract and one primary user-facing answer. It separates Puerto Rico operating date from next slate date, distinguishes current-day games from next-slate scheduled games, reports odds/prediction/recommendation readiness from the same resolver, labels evening actions without stale Morning Sync wording and keeps advanced legacy panels collapsed behind lazy Developer Mode groups. Daily Report no longer blocks the primary dashboard. No official-pick thresholds, champion rows, settlement policy, provider-budget policy or V7 promotion state were changed.

### BSN Official Ecosystem Data Acquisition Audit V1

Status: Completed and build verified.

Evidence: `docs/bsn-data-acquisition-strategy.md`.

Note: This was a discovery-only strategy sprint. It did not add imports, prediction modules or dashboard pages. Official BSN pages and app-store metadata were audited with bounded public requests. Robots and terms make unapproved internal API/chunk scraping unsuitable; the permanent recommendation is permissioned official feed/API primary, legally sourced CSV fallback, audited manual entry emergency path and licensed provider only after BSN coverage is verified.

### BSN Source Framework V1

Status: Completed and build verified.

Evidence: `src/services/basketball-source-framework.service.ts`, `/api/bsn/sources`, `/api/bsn/source-quality`, `/api/bsn/sources/validate`, `/api/bsn/import`, BSN capability/sync/readiness integration and `docs/bsn-source-framework-v1.md`.

Note: This is the reusable basketball connector blueprint for BSN, NBA, NCAA, EuroLeague, FIBA, WNBA and future basketball leagues. It supports official-source discovery, future APIs, CSV import, manual entry and future providers with validation, dry-run import planning, quality reporting, normalized target-table mapping and strict no-fabrication/no-write guardrails. BSN remains source/provider/odds/calibration blocked for production betting.

### MLB Operations Center V1

Status: Completed and build verified.

Evidence: `src/services/mlb-operations-center.service.ts`, `/api/mlb/operations-center` and `/mlb-operations`.

Note: This is an internal admin monitor, not a user-facing recommendation feature. It aggregates operating-day lifecycle, Current Board, provider health and budget, intelligence coverage, prediction engine, model quality, settlement, automation, known limitations, developer links and a non-inflated MLB readiness score from existing read-only services. It makes 0 provider calls and does not alter official thresholds, champion rows, settlement, learning, provider budget rules, Current Board logic or V7 promotion state.

### MLB Player Status Availability Integration V1

Status: Completed and build verified.

Evidence: `src/services/mlb-missing-intelligence.service.ts`, `src/services/sportsdataio-mlb-prospective-preview.service.ts`, MLB Data Quality integration, MLB AI Coach integration and `src/components/dashboard/MlbMissingIntelligencePanel.tsx`.

Note: SportsDataIO `Player.Status` is now normalized as roster availability and injured-list detection while the detailed injury endpoint remains subscription-blocked. The integration preserves raw provider status, normalized availability, provider/canonical player IDs, team mapping, source and freshness. V7 Confidence Engine V2 applies only bounded data-confidence effects for stale/unknown status and IL context; no injury severity, expected return, confirmed lineup absence, official-threshold change, champion mutation or V7 promotion is inferred.

### MLB Missing Intelligence Integration V1

Status: Completed with provider limitations and build verified.

Evidence: `src/services/mlb-missing-intelligence.service.ts`, `/api/mlb/missing-intelligence/health`, `src/components/dashboard/MlbMissingIntelligencePanel.tsx`, MLB Data Quality integration, MLB AI Coach integration and V7 Confidence Engine V2 missing-intelligence metadata in `src/services/sportsdataio-mlb-prospective-preview.service.ts`.

Note: The module reuses existing `sport_players`, `provider_entity_mappings`, `sport_lineups`, `sport_injuries`, `sport_player_stats` and `sports_sync_jobs` tables. It supports cache-first coverage, budget-checked live preflight and idempotent player metadata hydration when the SportsDataIO MLB `Players` feed is available. Confirmed lineups and injury feeds remain typed provider limitations for the current Discovery Lab path unless entitlement is verified. V7 remains challenger-only, official thresholds are unchanged, champion history is untouched and missing data never becomes positive evidence.

### Product Experience Polish V1

Status: Completed and build verified.

Evidence: `src/components/dashboard/ProductTodayPanel.tsx`, `src/components/dashboard/DeveloperDetails.tsx`, `src/components/dashboard/SportSelector.tsx`, `src/components/dashboard/DashboardShell.tsx`, `src/app/dashboard/page.tsx` and the human-facing daily-operations response fields in `src/services/autonomous-daily-operations.service.ts`.

Note: The dashboard now opens on the question "Should I bet today?" and keeps advanced diagnostics behind lazy Developer Mode sections. This was a product-surface change only; no new prediction models, sports, official thresholds, settlement logic or champion promotion paths were added.

### Autonomous Daily Execution, Settlement, and Learning V1

Status: Completed and build verified.

Evidence: `src/services/autonomous-daily-operations.service.ts`, `/api/autonomous-daily-operations/execute`, `/api/autonomous-daily-operations/daily-report`, `/api/autonomous-daily-operations/learning-report`, `/api/autonomous-daily-operations/scheduler`, `/api/autonomous-daily-operations/health`, `/api/autonomous-daily-operations/simulation`, `/api/autonomous-daily-operations/demo` and `ProductionTodayPanel`.

Note: The execution layer is protected, idempotent, dry-run by default, confirmation-gated and provider-budget-aware. It reuses the existing Operating Day executor for eligible stages and keeps learning suggestion-only with no automatic model promotion, threshold changes, official-history edits or unnecessary provider calls.

Controlled validation: The first confirmed production attempt intentionally did not execute the quota-consuming `final_refresh` because live readiness returned `UNSAFE_TIMING` after most of the slate had started. The same idempotency key reran as a zero-call, zero-write no-op. End-to-end settlement proof remains pending a temporally valid due stage.

Postgame validation: `sync_results` now returns `WAITING_FOR_FINALS` while any operating-day game remains active pregame or unresolved in stored operating-day status. Results sync, settlement, replay and learning proof remain pending until the cohort is terminal and a safe postgame window exists.

July 18 activation validation: The MLB operating day was idempotently created from 15 stored events, but production odds/features/predictions remained blocked by missing `SPORTSDATAIO_MLB_API_KEY` in the deployed environment. Status/linking robustness and late-night external schedules were tightened; official thresholds, champion rows and settlement gates remain unchanged.

### MLB Bullpen And Pitcher Intelligence V1

Status: Completed and build verified.

Evidence: `src/services/mlb-model-platform.service.ts`, `/api/mlb/intelligence/pitcher-bullpen-foundation`, MLB Data Quality integration, AI Coach integration and `docs/mlb-bullpen-pitcher-intelligence-v1.md`.

Note: This is a cache-first intelligence layer. It uses verified starter IDs/names plus cached `sport_player_stats` rows to report starter profile coverage, cached pitcher metrics, relief row coverage and workload signals. It does not claim closer availability, high-leverage roles, injuries or lineups without verified data, and it does not change official recommendation policy.

### MLB Player Metadata Cache V1

Status: Completed and build verified.

Evidence: `src/services/mlb-model-platform.service.ts`, `/api/mlb/players/metadata-cache` and `docs/mlb-player-metadata-cache-v1.md`.

Note: This module reports cached player identity, team, provider ID, position, roster, handedness and injury-status coverage with a 7-day TTL policy and zero provider calls. It confirms current identity/position mapping is ready while handedness and injury status remain explicit blockers.

### MLB Prediction Engine V7 And Confidence Engine V2

Status: Completed and build verified.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `/api/mlb/predictions/v7-regeneration`, V7 comparison support on `/api/mlb/predictions/comparison`, MLB prediction health annotations and `docs/mlb-prediction-engine-v7-confidence-v2.md`.

Note: V7 is challenger by default and shadow-evaluable. Confidence Engine V2 separates model, data, market and recommendation confidence. It uses verified starter/weather/stadium and persisted market evidence, but treats bullpen game workload, lineups, injuries and handedness as missing-data blockers. V7 does not change official recommendation thresholds or auto-promote.

### BSN Integration V1

Status: Architecture/readiness completed and build pending.

Evidence: `src/services/bsn-platform.service.ts`, `/api/bsn/capabilities`, `/api/bsn/data-quality`, `/api/bsn/sync`, `/api/bsn/predictions`, `/api/bsn/ai-coach`, BSN Feature Store registry entries and `docs/bsn-integration-v1.md`.

Note: BSN is registered as the second basketball league blueprint, but production predictions remain blocked. The previous mock-odds prediction path is replaced with a V7-style dry-run preflight, source/capability matrix and Confidence Engine V2 readiness output. Official picks, EV and Best Value are blocked until approved source ingestion and verified BSN odds exist.

### Highest-Probability Outcome V1

Status: Completed and build verified.

Evidence: `src/services/market-opportunity-suite.service.ts`, `/api/market-opportunities/most-likely`, `src/components/market-opportunities/MostLikelyTool.tsx`, MLB AI Coach integration and `docs/highest-probability-outcome-v1.md`.

Note: This module is informational only. It displays highest modeled probability, most-likely moneyline and an estimated two-leg moneyline parlay while preserving official recommendation-policy separation and making 0 provider calls.

### MLB Starter + Weather + Stadium Intelligence V1

Status: Completed and build verified.

Evidence: `src/services/mlb-starter-weather-stadium-intelligence.service.ts`, Feature Store Core MLB feature definitions, MLB V5 feature-set registry entries, Current Board enrichment, MLB prospective preview enrichment, Data Quality, AI Coach, Prediction Engine preview and `docs/mlb-starter-weather-stadium-intelligence-v1.md`.

Note: The module consumes stored GamesByDate verification evidence only and made 0 provider calls. Starting pitcher IDs/names, weather, wind and StadiumID are ready. Player details, player stats, stadium metadata, lineups, injuries, bullpen and historical calibration remain explicit next-phase blockers.

### MLB Games Payload Field Verification V1

Status: Completed and build verified.

Evidence: `src/services/mlb-games-payload-audit.service.ts`, `/api/mlb/games-payload-audit`, updated MLB data-quality and AI Coach evidence, and `docs/mlb-games-payload-field-verification-v1.md`.

Note: The final corrected 2026-07-17 GamesByDate verification verified populated starter IDs/names, weather, wind and `StadiumID` fields. Opener fields were present-null. No further GamesByDate verification call is needed for this audit.

### Core Dashboard And API Shell

Status: Completed.

Evidence: `src/app/dashboard/page.tsx`, dashboard panels in `src/components/dashboard`, and 100 API route files under `src/app/api`.

### Multi-Sport Engine

Status: Completed foundation.

Evidence: `docs/multi-sport-engine.md`, `src/config/sports.config.ts`, `src/types/multi-sport.ts`, `src/services/multi-sport-*.service.ts`, `/api/sports/*` routes and dashboard panels.

### Prediction Engine V4 And Shared Intelligence

Status: Completed foundation.

Evidence: `src/utils/prediction-engine-v4.ts`, `src/services/prediction-engine-v4.service.ts`, Kelly, Smart Ranking, Adaptive Scoring, model learning, risk grade, Monte Carlo and portfolio services.

### NBA Data Sync V1

Status: Completed and production-readiness verified for safe incremental behavior.

Evidence: `docs/nba-data-sync-v1.md`, `src/services/nba-data-sync.service.ts`, NBA sync API routes, NBA sync panel and migrations `202607110001` and `202607110002`.

### NBA Prediction Engine V1

Status: Completed architecture and build verified.

Evidence: `src/services/nba-prediction-engine.service.ts`, NBA prediction APIs and `NbaPredictionEnginePanel`. Current provider data may produce zero candidates when no NBA events/odds are available.

### NBA Prediction Validation & Settlement V1

Status: Completed and production-readiness verified for empty/no-op provider state.

Evidence: `docs/nba-prediction-validation-settlement-v1.md`, `src/services/nba-prediction-validation.service.ts`, `src/services/nba-prediction-settlement.service.ts`, NBA validation/settlement/performance/model-health/backlog APIs and migration `202607110003`.

### NBA Backtesting & Calibration V1

Status: Completed and build verified. Production summaries are gated by Production Data Gate V1; trial rows are exposed only as technical validation evidence.

Evidence: `docs/nba-backtesting-calibration-v1.md`, `src/services/nba-backtesting-calibration.service.ts`, `/api/nba/predictions/backtest`, `/api/nba/predictions/backtest/run`, `/api/nba/predictions/calibration` and `NbaBacktestingCalibrationPanel`.

### Production Data Gate V1

Status: Completed and build verified.

Evidence: `src/services/production-data-gate.service.ts`, `docs/production-data-gate-v1.md`, Feature Store validation fixtures, production-only prediction-history filters in analytics/model/recommendation services, and NBA backtest/calibration `trialTechnicalValidation` sections.

Note: Trial rows can validate mechanics only. Real production import promotion still requires explicit approval and the first real-data validation plan in `docs/first-real-data-validation-plan-v1.md`.

### Recommendation Experience And Official Picks Readiness V1

Status: Completed readiness and build verified; official activation remains blocked.

Evidence: `src/services/recommendation-eligibility-policy.service.ts`, `docs/recommendation-eligibility-policy-v1.md`, `docs/pick-explanation-experience-v1.md`, `docs/official-picks-readiness-v1.md`, updated Top Picks, Play of the Day, parlay, optimizer, portfolio, daily report and MLB replay surfaces.

Note: Official Top Picks, Play of the Day, parlays, Kelly/bankroll/portfolio and Bet Slip Optimizer now consume only `QUALIFIED`, `BEST_BET_CANDIDATE` and `PLAY_OF_DAY_CANDIDATE` statuses from the shared policy. Calibration is probationary, automatic production approval is false, current official picks remain 0 and quarantined replay/preview rows remain excluded from production consumers.

### MLB Day 1 Product Consolidation V1

Status: Completed without provider calls and build verified.

Evidence: `src/app/dashboard/page.tsx`, `src/components/dashboard/DashboardShell.tsx`, `/api/daily-report?mode=summary`, `/api/features/store/validation`, `/api/historical-import/jobs`, `/api/predictions/by-sport?historicalValidation=true&validationMode=quarantined&sport=baseball_mlb&date=2026-07-12`.

Note: The dashboard is consolidated into Today, Model Lab, Data & Operations and Advanced surfaces so the default MLB workflow leads with daily status, official pick gates and quarantined replay instead of provider/debug sprawl. Advanced model tools, NBA readiness, provider contracts and inactive sport engines remain available behind collapsed groups. The consolidation audit verified the configured Supabase schema probes as applied, confirmed no running historical import jobs, preserved 45 quarantined July 12 MLB replay rows with 0 production-eligible rows and made 0 SportsDataIO provider calls or remote mutations.

### Pick Analyzer UX Consolidation & Semantic Cleanup V1

Status: Completed presentation pass and build verified.

Evidence: `src/components/dashboard/MlbProspectivePreviewPanel.tsx`, `src/components/dashboard/MarketIntelligenceSummaryPanel.tsx`, `src/components/dashboard/MlbPredictionEnginePanel.tsx`, `src/app/dashboard/page.tsx`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `src/components/market-opportunities/AiBetFinderTool.tsx` and display-only semantic cleanup in `src/services/ai-bet-finder.service.ts`.

Note: This pass intentionally made no provider calls, no remote mutations and no prediction-calculation changes. It clarified selected-side explanations, current-market metrics, official-picks-off messaging, final-odds refresh wording, AI rating display, historical replay defaults and consistent opportunity-card semantics.

### Betting Workbench V1

Status: Completed and build verified.

Evidence: `src/app/betting-workbench/page.tsx`, `src/components/market-opportunities/BettingWorkbenchTool.tsx`, and the Betting Workbench navigation links in `src/components/dashboard/DashboardShell.tsx`.

Note: Betting Workbench is a workspace layer over existing read-only APIs. It compares candidates by probability, confidence, AI rating, value, risk, rationale and recommendation; drafts preview or official-only tickets; explores supported markets with search/filter/sort; and stores favorites plus notes in browser localStorage. It does not mutate Top Picks, Recommendation Policy, Current Board, production data or provider state.

### Premium Tools Reliability And Visual QA V1

Status: Completed and build verified.

Evidence: `src/services/current-board.service.ts`, `src/services/best-value-scanner.service.ts`, `src/services/market-opportunity-suite.service.ts`, `src/services/ai-bet-finder.service.ts`, `src/services/market-intelligence-engine.service.ts`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/BestValueTool.tsx`, `src/components/market-opportunities/ArbitrageTool.tsx`, `src/components/market-opportunities/AiBetFinderTool.tsx`, `src/components/market-opportunities/BettingWorkbenchTool.tsx`, `docs/current-board-intelligence-engine-v1.md`, `docs/best-value-scanner-v1.md`, `docs/ai-bet-finder-v1.md`, `docs/arbitrage-scanner-v1.md` and `docs/betting-workbench-v1.md`.

Note: This pass fixed timeout-prone broad selection by making premium tools consume the canonical Current Board and scoped odds reads. It added safe scanner states for Best Value and Arbitrage, query-understood metadata for AI Bet Finder, selection-aware explanations, mobile/tablet/desktop responsive hardening and screenshot-based QA evidence. It made 0 provider calls, 0 remote mutations, 0 prediction calculation changes, 0 official-pick changes and no Production Gate changes.

### MLB Day 1 Recovery Corrections V1

Status: Completed local recovery corrections; provider execution not started.

Evidence: `src/components/dashboard/DashboardShell.tsx`, `src/components/dashboard/AICommandCenterPanel.tsx`, `src/components/dashboard/DailyReportPanel.tsx`, `src/components/dashboard/MlbPredictionEnginePanel.tsx`, `src/components/dashboard/FeatureStoreCorePanel.tsx`, `src/components/dashboard/HistoricalImportEnginePanel.tsx`, `src/services/daily-report-fast.service.ts` and `src/services/historical-import-engine.service.ts`.

Note: Recovery audit confirmed the current API route count remains 205 and no provider calls or remote mutations were made during the correction pass. The dashboard now labels the product as Day 1 ready with official picks off, treats deterministic MLB engine previews as fixture validation, groups quarantined MLB historical replay rows by matchup, keeps AI recommendation detail collapsed when official picks are 0, exposes an MLB operational summary in the fast Daily Report, and distinguishes historical failed sync jobs from active import blockers. MLB 2025/2026 provider-backed historical enrichment was not executed because the existing protected historical-import execute path is still NBA-pilot-specific for live writes; safe MLB execution requires an MLB Discovery Lab executor with durable season/date/domain checkpoints before provider calls resume.

### Pick Analyzer Intelligence Suite V2

Status: Completed as read-only orchestration and build verified.

Evidence: `src/services/best-value-scanner.service.ts`, `src/services/ai-bet-finder.service.ts`, `/api/market-opportunities/best-value`, `/api/ai-bet-finder`, `/best-value`, `/ai-bet-finder`, `docs/best-value-scanner-v1.md` and `docs/ai-bet-finder-v1.md`.

Note: Best Value Scanner and AI Bet Finder consume Current Board as the trusted candidate source. They add optional premium workflows for Best Value, deterministic natural-language search, Compare, Explain/Why Not, Build My Ticket and What Changed. They made 0 provider calls, performed 0 remote mutations, did not alter prediction calculations, did not promote official picks and did not change Production Data Gate or Recommendation Eligibility Policy behavior. Current validation shows 0 positive modeled-value Best Value candidates by default, 3 no-modeled-value passes when shown, AI Bet Finder fixture validation 24/24 and official picks still 0.

### Market Intelligence Engine V1

Status: Completed as read-only orchestration and build verified.

Evidence: `src/services/market-intelligence-engine.service.ts`, `/api/market-intelligence`, `src/components/dashboard/MarketIntelligenceSummaryPanel.tsx` and `docs/market-intelligence-engine-v1.md`.

Note: Market Intelligence Engine scans Current Board candidates plus cataloged unavailable market families and returns availability, health, quality, confidence, classification, score, reason and explanation. It adds ranking modes for highest probability, EV, confidence, AI rating, lowest risk and best combined, plus explorer filters for sport, game, market, sportsbook, odds, risk, AI rating, confidence, edge, EV and recommendation. Current validation scans 16 markets, supports 3 current `NYM @ PHI` markets, marks all 3 current candidates as Pass, keeps 13 unavailable/future/blocked entries visible, passes fixtures 18/18, makes 0 provider calls and performs 0 remote mutations.

### Day 1 Recommendation Readiness V1

Status: Completed as read-only audit and build verified.

Evidence: `src/services/day1-recommendation-readiness.service.ts`, `/api/recommendation-readiness`, `src/components/dashboard/RecommendationReadinessPanel.tsx` and `docs/day1-recommendation-readiness-v1.md`.

Note: The readiness audit verifies the full Current Board -> Market Intelligence -> Recommendation Policy -> Top Picks -> AI Bet Finder -> Bet Slip -> Dashboard path using stored data only. Current result is 3 shared candidates, 0 official picks, Bet Slip `no_ticket`, 0 provider calls, 0 remote mutations and fixture validation 20/20. Candidate-level quality audit reports probability, confidence, reliability, AI rating, feature quality, data sufficiency, market stability, edge, EV, recommendation and explanation. Threshold review keeps Day 1 gates conservative; a tiny positive edge does not qualify. An in-memory excellent-value production simulation reaches `PLAY_OF_DAY_CANDIDATE`, proving automatic activation would work when every real gate is met without promoting current quarantined previews.

### MLB Discovery Lab Historical Import Executor V1

Status: Live executor and 2025 standings reconciliation checkpoint verified.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts` and `src/app/api/historical-import/execute/route.ts`.

Note: The existing protected execute route now dispatches `baseball_mlb` requests to an MLB Discovery Lab manifest with durable checkpoint identities in `sports_sync_jobs.metadata`, zero-call dry-run planning, completed-checkpoint skip behavior, quarantine flags and production gate closure. The first approved live unit called `GET /api/mlb/odds/json/Games/2026` once, received HTTP 200, fetched 2,456 provider records, inserted 2,441 new `sport_events`, inserted 2,441 provider mappings, reused/updated 30 teams, wrote completed sync job `dbd8ab2b-8351-4b3b-b5ff-3865d672a748`, and preserved `trial=false`, `scrambled=false`, `production_eligible=false`. The executor now uses the shared Discovery Lab URL resolver for app-path SportsDataIO calls; the 2025 `Standings` checkpoint was later reconciled after a single app-path `Teams` verification classified IDs `7` and `27` as non-schedule provider records. Current 2025 dry-run skips `Standings/2025` and selects `TeamSeasonStats/2025` as the next safe unit.

### MLB First Live Recommendations Operating Day V1

Status: Current slate analyzed; official bet correctly blocked.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/app/api/historical-import/execute/route.ts`, `/api/current-board`, `/api/market-intelligence`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/ai-bet-finder`, `/api/predictions/top`, `/api/play-of-the-day` and `/api/daily-report?mode=summary`.

Note: The operating run completed `TeamSeasonStats/2025`, `PlayerSeasonStats/2025`, `GamesByDate/2026-JUL-16`, `GameOddsByDate/2026-07-16` and `PlayerGameProjectionStatsByDate/2026-JUL-16` with 5 provider calls and no raw payload storage. Current Board has 3 `NYM @ PHI` analyzed candidates using fresh odds at `2026-07-16T14:57:10Z`; Market Intelligence marks all current markets as passes; Best Value has 0 positive modeled-value rows; AI Bet Finder ticket building returns `NO TICKET TODAY`; Top Picks and Play of the Day remain empty. A distinct `operatingDayFinalRefresh` path is available for one final pre-cutoff odds refresh without reusing the completed operating-day odds checkpoint.

### Prospective Official Eligibility Gate V1

Status: Completed as zero-call policy/audit and protected exact-candidate action.

Evidence: `src/services/prospective-official-eligibility-gate.service.ts`, `/api/recommendation-readiness?eligibilityGate=true`, `/api/recommendation-readiness?validate=eligibilityGate`, protected `POST /api/recommendation-readiness`, and `docs/prospective-official-eligibility-gate-v1.md`.

Note: The gate distinguishes permanent validation rows from real prospective rows, preserves the strict calibration and recommendation thresholds, and represents `PROSPECTIVE_OFFICIAL_ELIGIBLE` as an audit state rather than a public pick. `PROSPECTIVE_OFFICIAL` requires exact candidate activation with prediction/event/snapshot/odds identity, model and feature versions, reason and idempotency key. Current `NYM @ PHI` rows remain not official because edge and EV are negative and calibration/confidence gates fail. Fixture validation proves an excellent future candidate would become eligible for review while insufficient calibration, stale odds, historical rows and tiny edge remain blocked.

### MLB Discovery Lab Season-Wide Completion V1

Status: Completed season-wide 2026 branches and one bounded date-domain pilot; bulk date import not started.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute` and `sports_sync_jobs` jobs `2aed3a85-768f-4a13-9b22-5ed93649879f`, `4cb59805-8f2e-4632-9afd-319b2df5c236`, `de7ed98f-1182-44b1-a030-330c6e186229` and `816ec464-e838-4e6e-aa62-f62f8bff74b4`.

Note: The resumed executor completed the three approved season-wide calls: `Standings/2026` persisted 30 standings plus 30 mappings, `TeamSeasonStats/2026` persisted 30 canonical `team_stats` rows, and `PlayerSeasonStats/2026` persisted 1,303 season `sport_player_stats` plus 1,303 mappings while preserving 708 unresolved player mappings as non-blocking evidence. The generated 2026 date ledger found 76 completed import-eligible dates. The first bounded date-domain pilot called `TeamGameStatsByDate/2026-MAR-26`, inserted 26 `sport_game_stats` rows and wrote a completed checkpoint. All rows remain quarantined with `production_eligible=false`; official picks, feature generation, predictions and bulk date import remain disabled.

### MLB Discovery Lab Date Import Batch V1

Status: Completed bounded 180-call 2026 date-domain import batch; feature sample blocked by missing complete settlement inputs.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute`, `docs/PROJECT_STATUS.md` and 180 completed `sports_sync_jobs` from `c4a42303-44f9-4951-b9cd-816216941742` through `a3b70538-42be-4157-ad7a-37d1bd6f02ba`.

Note: The batch resumed from `PlayerGameStatsByDate/2026-MAR-26`, used exactly 180 of 180 approved provider calls, completed 60 player-stat, 60 odds and 60 team-stat checkpoints, and stopped at the cap after `TeamGameStatsByDate/2026-MAY-25`. All endpoints returned HTTP 200. The batch persisted 1,614 `sport_game_stats` rows, 23,346 game `sport_player_stats` rows, 23,346 provider mappings, 4,824 `sports_odds_snapshots` rows and 180 sync-job checkpoints, with 0 duplicate logical rows, 0 orphan rows, 0 invalid odds fields, 0 live/alternate contamination and 0 production-eligible leakage. The exact next resume unit is `PlayerGameStatsByDate/2026-MAY-25`; 47 date-domain calls remain for the current 2026 ledger. The requested historical feature/prediction sample was not generated because the new batch had only 36 cutoff-safe odds rows across 6 events and 0 events with complete result/team-game-stat settlement inputs.

### MLB Discovery Lab Date Import Resume V2

Status: Partially completed; stopped on June 8 team-stat unresolved-event validation before retrying or promoting the checkpoint.

Evidence: `sports_sync_jobs` jobs from `6bbe3543-0a05-44d6-b2c0-bc8bf00c541f` through partial job `f3f6949d-8f39-4c91-8912-493df4a2a0c0`, plus `docs/PROJECT_STATUS.md`.

Note: The resume used 42 of 47 approved provider calls. Calls 1-41 completed through `GameOddsByDate/2026-06-07`; call 42 reached `TeamGameStatsByDate/2026-JUN-08`, returned HTTP 200, inserted 10 team-stat rows for all 5 persisted June 8 events, but remained partial because 3 provider records could not be mapped to persisted events and the skipped provider IDs were not preserved in metadata. The resume persisted 358 `sport_game_stats` rows, 5,504 game `sport_player_stats` rows, 5,504 provider mappings and 1,122 `sports_odds_snapshots` rows with 0 duplicate/orphan/invalid/live/alternate/production-leakage findings. Dry-run now reports 6 incomplete units beginning with the partial June 8 team-stat checkpoint. Feature/prediction generation was not run because the ledger is incomplete and a zero-provider eligibility audit found 0 eligible completed-window events.

### MLB Discovery Lab June 8/9 Checkpoint Completion V1

Status: Completed through the approved June 8/9 ledger; feature generation blocked by cutoff-safety.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute`, completed sync jobs `182965b6-9e70-4f11-a376-8dc112d6c9fd`, `e87f15ef-128e-4e67-b8e7-890c07b9025b`, `50cad854-ae08-4ca1-9770-141d1fa3d142`, `551bd293-d8c3-4aa3-926b-02849bb30577`, `e5ae21a5-a426-4b40-a774-04770a428492`, `8dd683f0-180a-4674-9323-0ce623c125d5` and `docs/PROJECT_STATUS.md`.

Note: The paginated event resolver fixed the June 8 partial checkpoint safely. The final retry of `TeamGameStatsByDate/2026-JUN-08` reused the existing 10 rows, inserted the 6 missing rows and completed with 0 unresolved teams/events. The continuation completed `PlayerGameStatsByDate/2026-JUN-08`, `GameOddsByDate/2026-06-08`, `TeamGameStatsByDate/2026-JUN-09`, `PlayerGameStatsByDate/2026-JUN-09` and `GameOddsByDate/2026-06-09`, for 6 total HTTP 200 provider calls in this completion pass. The pass inserted 36 new `sport_game_stats` rows, 1,448 `sport_player_stats` rows, 1,448 player-stat provider mappings and 138 `sports_odds_snapshots` rows, with 0 duplicate/orphan/invalid/live/alternate/production-leakage findings. Dry-run now reports no pending June 8/9 units. Feature snapshots, predictions and settlement updates were not generated because a zero-provider eligibility audit found 0 cutoff-safe odds events and 0 eligible feature events in the completed May 25 through June 9 window.

### MLB Historical Foundation 2026 Completion And 2025 Checkpoint V1

Status: Partially completed; 2026 date-domain ledger complete, 2025 safely stopped on standings mapping ambiguity.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute`, completed sync jobs from `a91f963b-194c-4372-a02c-2ac802736583` through `a73baa79-52a0-4d07-82fe-70f67cb1cb16`, 2025 schedule job `6654651b-948e-481e-94e6-0b61b59de3fb`, partial standings job `61d79b52-1c60-4997-8e32-891a35f6cc07` and `docs/PROJECT_STATUS.md`.

Note: The guarded resume completed the remaining 2026 imported game dates through July 12. A failed `TeamGameStatsByDate/2026-JUL-12` attempt exposed that MLB team game stats must upsert against the deployed natural unique key `sport_key,event_id,team_id`, not only deterministic `id`; the executor now uses that key and the repaired retry reused/updated 30 existing July 12 team-stat rows without duplicating persistence. Final 2026 dry-run reports `estimatedCalls=0` and `nextIncompleteUnit=null`. The 2025 import started with `Games/2025`, which completed with HTTP 200 and built the regular-season date ledger. `Standings/2025` returned HTTP 200 and inserted 60 normalized rows, but remains partial because 2 provider standing records could not be mapped to stored teams. Further 2025 team/player/odds imports, recalibration, official picks and production promotion are blocked until that mapping ambiguity is reviewed without provider calls.

### MLB Standings/2025 Partial Checkpoint Resume V1

Status: Safely stopped; exact unresolved provider team IDs captured, no deterministic local repair.

Evidence: `src/services/sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute`, partial jobs `61d79b52-1c60-4997-8e32-891a35f6cc07` and `adbf4908-71fb-4800-8f62-0af23e753a64`, and `docs/PROJECT_STATUS.md`.

Note: Zero-provider audit proved the 30 persisted 2025 schedule teams already have canonical team rows, provider mappings and 2025 standings rows. The original partial checkpoint did not retain the skipped provider IDs, so season-wide validation metadata now records sanitized unresolved IDs. The single approved `Standings/2025` retry used one provider call, returned HTTP 200, reused/updated the existing 60 normalized standing/mapping rows and captured unresolved provider team IDs `7` and `27`. Read-only evidence found no persisted 2025 events, `sports_teams` rows or provider mappings for those IDs. No synthetic teams, broad mapping changes, feature generation, calibration, official picks or production promotion were performed. The next safe action is external/provider identity confirmation for IDs `7` and `27` or an explicit non-team skip rule before any further 2025 import.

### MLB Prospective Slate Capture And First Model Preview V1

Status: Completed for the first selected future slate; official picks remain blocked.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `/api/historical-import/execute`, `/api/predictions/by-sport?sport=baseball_mlb&prospectivePreview=true`, `src/components/dashboard/MlbProspectivePreviewPanel.tsx`, `src/app/dashboard/page.tsx`, completed SportsDataIO prospective checkpoints and `docs/PROJECT_STATUS.md`.

Note: The first prospective capture selected `2026-07-16`, used 3 of 6 approved provider calls with HTTP 200 statuses for `GamesByDate/2026-JUL-16`, `GameOddsByDate/2026-07-16` and `PlayerGameProjectionStatsByDate/2026-JUL-16`, and persisted 6 genuine pregame `Consensus` odds rows for `NYM @ PHI`. The projections endpoint returned 0 rows, so pitcher, lineup, injury, weather and bullpen domains remain explicit unavailable warnings rather than fabricated features. The local-only feature/prediction resume inserted or reused 3 prospective feature snapshots and 3 linked preview predictions, then reran idempotently with 3 snapshots and 3 predictions reused. All rows are non-trial, non-scrambled, quarantined and `production_eligible=false`; official picks, Play of the Day, parlays, Kelly, bankroll, portfolio, settlement, model training and production promotion remain off. Safety validation found 0 duplicate snapshots, 0 duplicate predictions, 0 orphan links, 0 official picks and 0 production leakage. The Today dashboard now exposes `MLB MODEL PREVIEW` separately from historical replay.

### MLB Prospective Final Pregame Refresh V1

Status: Completed for the `2026-07-16` slate; official picks remain blocked.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `/api/historical-import/execute`, completed checkpoint `ec1bf8f7-0126-46b6-877e-76afe07112b6`, `/api/predictions/by-sport?sport=baseball_mlb&prospectivePreview=true` and `docs/PROJECT_STATUS.md`.

Note: The final bounded pregame refresh used exactly 1 provider call to `GameOddsByDate/2026-07-16`, returned HTTP 200, inserted 6 new timestamped pregame `Consensus` odds rows at `2026-07-15T19:57:26Z`, and preserved the initial `2026-07-15T19:03:13Z` capture. Local snapshot/prediction refresh then reused the completed odds checkpoint without another provider call, leaving 6 prospective snapshots and 3 logical preview predictions tied to the latest safe odds. All three rows remained `ANALYZED_ONLY`; official Top Picks stayed 0, Play of the Day stayed none, Bet Slip stayed `no_ticket`, and safety checks found 0 duplicates, 0 orphan links and 0 production leakage.

### MLB Prediction Intelligence V1

Status: Completed for quarantined prospective previews; official picks remain blocked.

Evidence: `src/services/sportsdataio-mlb-prospective-preview.service.ts`, `src/services/prediction-history.service.ts`, `src/components/dashboard/MlbProspectivePreviewPanel.tsx`, `/api/predictions/by-sport?sport=baseball_mlb&prospectivePreview=true` and `docs/PROJECT_STATUS.md`.

Note: The prospective model now derives baseball-specific intelligence from already imported rows only: last 3/5/10 and season form, home/away split, opponent difficulty, rest/schedule density, momentum, explicit bullpen-unavailable status, Team Strength Index, confidence label, reliability score, AI rating/grade, ranking score, market stability and baseball-language factors. The Team Strength Index formula is `0.30 season win pct + 0.20 last-10 win pct + 0.20 per-game run differential + 0.10 home/away split + 0.10 opponent difficulty + 0.10 rest score`. The local recompute made 0 provider calls, created immutable `mlb_prediction_intelligence_v1` snapshot lineage for the existing final odds, kept all visible previews `ANALYZED_ONLY`, and reran idempotently with 3 snapshots reused and 3 predictions reused. Missing MLB domains remain starting pitcher, confirmed lineup, injury diagnosis, weather and derivable bullpen context before official recommendations can be considered.

### Pick Analyzer User Experience And Betting Intelligence V2

Status: Completed as presentation-only UX polish; official picks remain blocked.

Evidence: `src/app/dashboard/page.tsx`, `src/components/dashboard/MlbProspectivePreviewPanel.tsx`, `src/components/dashboard/TopPicksPanel.tsx`, `src/components/dashboard/PickExplanationCard.tsx`, `src/components/dashboard/BetSlipOptimizerPanel.tsx`, `src/components/dashboard/MlbPredictionEnginePanel.tsx` and `docs/PROJECT_STATUS.md`.

Note: The dashboard now leads with the user question `Should I Bet Today?` and translates internal statuses into `GOOD BET`, `WATCH`, `NO VALUE` and `PASS` presentation labels while preserving internal recommendation enums. MLB preview cards separate model opinion from bet value, use `Sportsbook thinks` and `Pick Analyzer thinks`, group explanations into `Why We Like It`, `Why We Don't` and `Missing Information`, and keep edge, EV, feature quality, sufficiency, cutoff, timestamps and lineage under `Advanced Details`. Top Picks, Bet Slip, Pick Explanation and Historical Replay now use consumer wording and educational flows without changing recommendation policy, model calculations, provider integrations, persistence or production gates. Data Ops opens with a simple system-health summary and collapses engineering surfaces.

### Pick Analyzer Market Opportunity Suite V1

Status: Completed as optional read-only tools; no workflow or recommendation policy changes.

Evidence: `src/services/market-opportunity-suite.service.ts`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/arbitrage`, `src/app/most-likely/page.tsx`, `src/app/arbitrage/page.tsx`, `src/components/market-opportunities/MostLikelyTool.tsx`, `src/components/market-opportunities/ArbitrageTool.tsx`, `src/components/dashboard/DashboardShell.tsx` and `docs/PROJECT_STATUS.md`.

Note: The suite adds separate `Most Likely` and `Arbitrage` navigation items as extra utilities. Most Likely ranks stored prediction rows by probability first and supports alternate user sorts without feeding Top Picks, Bet Slip, Play of the Day or official picks. Arbitrage scans stored odds only and refuses guaranteed-arbitrage claims unless all outcomes are covered for the same game, market, period/rules and fresh verified sportsbook prices with positive margin. Current validation used 0 provider calls and 0 remote mutations: Most Likely returned stored rows; Arbitrage returned unavailable because the current stored data does not expose verified multi-book pricing. Notification controls are UI placeholders only and do not create a backend notification service.

Correction: Most Likely now defaults to `Current Board` instead of all stored rows. The default board requires future/unstarted current-slate candidates, latest non-superseded prediction rows, latest safe pregame odds before start/cutoff, deduplication by sport/event/market/period/selection/model version, and exclusion of historical, settled, stale, live/alternate, fixture and legacy-unlinked rows. Explicit modes are `Current Board`, `Upcoming`, `Historical Explorer` and advanced `All Stored Data`. Current validation returned the `NYM @ PHI` 2026-07-16 preview slate only, with 3 analyzed candidates across moneyline, run line and total, 0 qualified official picks, 0 provider calls and 0 remote mutations.

### Current Board Intelligence Engine V1

Status: Completed as canonical read-only candidate selection.

Evidence: `src/services/current-board.service.ts`, `/api/current-board`, `src/services/market-opportunity-suite.service.ts`, `src/services/daily-report-fast.service.ts`, `docs/current-board-intelligence-engine-v1.md` and `docs/PROJECT_STATUS.md`.

Note: Current Board is the shared source for "what valid betting candidates exist right now" and does not create a prediction engine, recommendation policy or production promotion path. Default `CURRENT` mode includes only future/unstarted current-slate candidates with valid event and snapshot linkage, latest safe pregame odds before cutoff/start, supported markets, no stale/live/alternate/fixture/historical/settled/legacy rows and no duplicate logical candidate. Most Likely now consumes Current Board and only ranks/presents candidates. Daily Report Today counts now use Current Board for slate games, current odds, analyzed candidates, modeled-value candidates, watch candidates, qualified previews, official picks, latest odds and next refresh action. Official consumers still require Production Data Gate V1 plus Recommendation Eligibility Policy V1. Current validation returned `NYM @ PHI`, 3 analyzed preview candidates, 0 official picks, fixture validation 20/20, 0 provider calls and 0 remote mutations.

### NBA Data Quality And Historical Reconciliation Phase A

Status: Completed and build verified.

Evidence: `docs/nba-data-quality-reconciliation-phase-a.md`, `src/services/nba-data-quality.service.ts`, `/api/nba/data-quality`, `/api/nba/data-quality/issues`, `/api/nba/data-quality/coverage`, `/api/nba/reconciliation/plan`, `/api/nba/reconciliation/status` and `NbaDataQualityPanel`.

### NBA Multi-Book Comparison V1

Status: Completed stored-data architecture and build verified.

Evidence: `docs/nba-multi-book-comparison-v1.md`, `src/services/nba-multi-book-comparison.service.ts`, `/api/nba/markets/multi-book` and `NbaMultiBookComparisonPanel`.

Note: The module returns a typed empty response when no NBA odds snapshots exist. Real best-price opportunity volume depends on future stored odds coverage.

### NBA Steam Move Detection V1

Status: Completed stored-data architecture and build verified.

Evidence: `docs/nba-steam-move-detection-v1.md`, `src/services/nba-steam-move-detection.service.ts`, `/api/nba/markets/steam` and `NbaSteamMovePanel`.

Note: The module returns typed empty or insufficient-history responses when stored NBA odds snapshots are unavailable or too shallow. Real steam signals depend on future repeated stored odds snapshots.

### Provider Intelligence V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/provider-intelligence-v1.md`, `src/services/provider-intelligence.service.ts`, `/api/providers/intelligence`, `/api/providers/capabilities`, `/api/providers/route-plan` and `ProviderIntelligencePanel`.

Note: The module uses static registry and environment configuration only. It makes zero provider calls and supports dry-run routing decisions.

### Global Data Quality Framework V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/global-data-quality-framework-v1.md`, `src/services/global-data-quality.service.ts`, `/api/data-quality/global`, `/api/reconciliation/plan` and `GlobalDataQualityPanel`.

Note: The module is read-only and dry-run only. It identified stored-state issues and estimated provider calls without executing any provider work.

### API Contract Hardening V1

Status: Completed representative adoption and build verified.

Evidence: `docs/api-contract-hardening-v1.md`, `src/lib/api-contract.ts`, hardened provider intelligence routes, hardened global data quality routes and typed bad-request validation.

Note: This is a gradual adoption layer, not a risky whole-repository route rewrite.

### Runtime Observability V1

Status: Completed read-only aggregation and build verified.

Evidence: `docs/runtime-observability-v1.md`, `src/services/runtime-observability.service.ts`, `/api/observability/runtime` and `RuntimeObservabilityPanel`.

Note: The module uses existing storage only. Persisted request-duration and warning-event history are future additive enhancements.

### Sync Reliability Framework V1

Status: Completed additive framework and build verified.

Evidence: `docs/sync-reliability-framework-v1.md`, `src/services/sync-reliability.service.ts`, `/api/sync/reliability` and `SyncReliabilityPanel`.

Note: The framework is available for incremental adoption. Existing provider-backed sync flows were not mass-rewritten.

### Prediction Safety Framework V1

Status: Completed additive framework and build verified.

Evidence: `docs/prediction-safety-framework-v1.md`, `src/services/prediction-safety.service.ts`, `/api/prediction-safety` and `PredictionSafetyPanel`.

Note: NBA Prediction Validation V1 remains unchanged. The generic safety checks are available for incremental adoption and future sports.

### Settlement Core V2

Status: Completed additive framework and build verified.

Evidence: `docs/settlement-core-v2.md`, `src/services/settlement-core.service.ts`, `/api/settlement/core` and `SettlementCorePanel`.

Note: NBA Prediction Settlement V1 remains unchanged. Shared settlement primitives are available for incremental adoption.

### Model Metrics Framework V1

Status: Completed computed framework and build verified.

Evidence: `docs/model-metrics-framework-v1.md`, `src/services/model-metrics-framework.service.ts`, `/api/model/metrics` and `ModelMetricsFrameworkPanel`.

Note: Metrics are computed from stored `prediction_history`. Persisted metric snapshots are future optional work.

### Historical Import Engine Core V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/historical-import-engine-core-v1.md`, `src/services/historical-import-engine.service.ts`, `/api/historical-import/plan`, `/api/historical-import/health`, `/api/historical-import/jobs` and `HistoricalImportEnginePanel`.

Note: The module is dry-run only. It plans season/date-range checkpoints, idempotency, deduplication, provider routing and quota estimates without external provider calls or migrations.

### Provider Adapter SDK V1

Status: Completed provider-independent architecture and build verified.

Evidence: `docs/provider-adapter-sdk-v1.md`, `src/services/provider-adapter-sdk.service.ts`, `/api/providers/sdk`, `/api/providers/sdk/validation` and `ProviderAdapterSdkPanel`.

Note: The module defines provider contracts, capability declarations, auth shape, pagination, rate-limit hints, retry hints, normalization rules and fixture validation without external provider calls.

### SportsDataIO Adapter Contract V1

Status: Completed contract-only architecture and build verified.

Evidence: `docs/sportsdataio-adapter-contract-v1.md`, `src/services/sportsdataio-adapter-contract.service.ts`, `/api/providers/sportsdataio/contract`, `/api/providers/sportsdataio/validation` and `SportsDataIoContractPanel`.

Note: The module maps SportsDataIO-style concepts into Provider Adapter SDK contracts and normalized models. Live calls are disabled, credentials are not required, and validation uses local fixtures only.

### SportsDataIO Historical Import Execution Readiness V1

Status: Completed execution architecture and deterministic validation.

Evidence: `docs/sportsdataio-historical-import-execution-readiness-v1.md`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/providers/sportsdataio/status`, `/api/providers/sportsdataio/capabilities`, `/api/providers/sportsdataio/execution-readiness/validation`, `/api/historical-import/execute`, `/api/historical-import/resume`, `/api/historical-import/cancel`, `/api/historical-import/jobs/[jobId]`, `/api/historical-import/pilot-plan`, `/api/historical-import/validate/[jobId]` and `HistoricalImportEnginePanel`.

Note: The module prepares server-only SportsDataIO execution architecture with hard caps, dry-run defaults, resume/cancel contracts, validation contracts, a zero-call execution-readiness validation API, pilot planning and dashboard guardrails. `HistoricalImportEnginePanel` also displays the execution-readiness validation packet with pass counts, closed guardrail statuses, pre-transport live-shape rejection and the one-to-many counter fixture. The initial 401 on `GamesByDate` was resolved during NBA Pilot Import V1. Completion labels are `EXECUTION_ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `LIVE_PROVIDER_VALIDATION_COMPLETE` and `PILOT_IMPORT_COMPLETE_FOR_APPROVED_TRIAL_SCOPE`.

### SportsDataIO NBA Pilot Import V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-pilot-import-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/historical-import/jobs`, `/api/nba/data-quality`, `/api/nba/features/preview` and `/api/nba/predictions`.

Note: The module validated SportsDataIO `Teams` and `GamesByDate/2025-DEC-25` with 2 external calls, fetched 35 trial/scrambled records, updated 30 existing NBA team rows with SportsDataIO pilot provenance, inserted 35 provider mappings, inserted 5 trial events, persisted 4 completed scores and recorded sync-job observability. Trial events and mappings are marked `trial=true`, `scrambled=true` and `production_eligible=false`; NBA prediction generation and validation exclude them from production predictions. Completion labels are `EXECUTION_ARCHITECTURE_COMPLETE`, `LIVE_PROVIDER_VALIDATION_COMPLETE`, `PILOT_IMPORT_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE` and `REAL_DATA_RECONCILIATION_PENDING`.

### SportsDataIO NBA Pilot Import V2

Status: Completed capped live trial verification and build verified.

Evidence: `docs/sportsdataio-nba-pilot-import-v2.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/historical-import/jobs`, `/api/nba/data-quality`, `/api/nba/data-quality/coverage` and `/api/nba/features/preview`.

Note: The V2 verification rerun for `2025-DEC-26` used 4 external calls and reached GamesByDate, standings, team season stats and team game stats. It fetched 87 records, normalized 87 records, inserted 18 game-stat rows, updated existing events, standings, team stats and mappings idempotently, skipped 0 records, recorded 0 errors and completed the latest sync job. Trial rows remain `trial=true`, `scrambled=true` and `production_eligible=false`; production prediction queries returned zero trial leaks. Completion labels are `EXECUTION_ARCHITECTURE_COMPLETE`, `LIVE_PROVIDER_VALIDATION_COMPLETE`, `PILOT_IMPORT_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE`, `GAME_STATS_PERSISTENCE_COMPLETE` and `REAL_DATA_RECONCILIATION_PENDING`.

### SportsDataIO NBA Injuries Pilot V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-injuries-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/nba/data-quality`, `/api/nba/features/preview` and `/api/nba/predictions/health`.

Note: The successful import execution called `/v3/nba/projections/json/InjuredPlayers` once, fetched 6 trial/scrambled records, normalized 6 injuries, inserted 6 `sport_injuries` rows, inserted 6 injury provider mappings, skipped 0 records, preserved 2 unresolved players and 2 unresolved teams as warnings and recorded 0 row errors. Injury and mapping rows carry `source=sportsdataio`, `trial=true`, `scrambled=true`, `production_eligible=false` and `importModule=sportsdataio_nba_injuries_pilot_v1`. Completion labels are `LIVE_PROVIDER_VALIDATION_COMPLETE`, `INJURY_PERSISTENCE_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE` and `PRODUCTION_CONFIDENCE_LEAKAGE_BLOCKED`.

### NBA Injury and Lineup Confidence Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/nba-injury-lineup-confidence-integration-v1.md`, `src/services/nba-injury-lineup-confidence.service.ts`, enriched `src/services/nba-feature-store-integration.service.ts`, `src/services/nba-prediction-engine.service.ts`, `src/services/prediction-safety.service.ts`, `src/services/nba-prediction-settlement.service.ts`, `NbaFeatureStoreIntegrationPanel` and `NbaPredictionEnginePanel`.

Note: The module consumes stored `sport_injuries` rows and static provider configuration state only. Trial/scrambled injuries cannot improve production confidence, stale/unresolved rows create warnings and penalties, missing lineups remain explicit unavailable context, no predictions are persisted and no provider calls are made.

### SportsDataIO NBA Players Pilot V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-players-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `/api/historical-import/execute`, `/api/nba/data-quality`, `/api/nba/features/preview` and `/api/nba/predictions/health`.

Note: The successful import execution called `Players` once, fetched 579 trial/scrambled records, normalized 579 players, inserted 579 `sport_players` rows, inserted 579 player provider mappings, skipped 0 records and recorded 0 row errors. Player and mapping rows carry `source=sportsdataio`, `trial=true`, `scrambled=true`, `production_eligible=false` and `importModule=sportsdataio_nba_players_pilot_v1`. The module also hardened Supabase preflight reads by chunking large `.in()` requests. Completion labels are `LIVE_PROVIDER_VALIDATION_COMPLETE`, `PLAYER_MAPPING_PERSISTENCE_COMPLETE`, `TRIAL_DATA_ISOLATION_COMPLETE` and `PROP_AND_LINEUP_USAGE_BLOCKED`.

### SportsDataIO NBA Depth Charts And Starting Lineups Pilot V1

Status: Completed capped live verification and build verified.

Evidence: `docs/sportsdataio-nba-depth-lineups-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/services/nba-injury-lineup-confidence.service.ts` and `supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql`.

Note: The guarded execution path for `/v3/nba/scores/json/DepthCharts` and `/v3/nba/projections/json/StartingLineupsByDate/2025-DEC-26` completed with exactly 2 external calls, trial isolation, no prediction persistence, no backtesting and no model training. The `sport_lineups` migration is applied remotely and the service upserts lineup/depth relationship rows by `sport_lineups.id`. Payload Normalization V1 added sanitized payload-shape summaries, nested player-row flattening, home/away lineup context, position-group depth context and duplicate upsert-batch prevention. The verified rerun persisted 758 `sport_lineups` rows and 758 provider mappings, preserved 54 unresolved player references safely, completed sync job `ae45b0bd-57d9-4f58-9095-0f014781185c`, blocked production confidence leakage and kept trial rows excluded from production predictions. Historical Import Reporting Counter Fix V1 keeps `records_skipped` nonnegative and separately reports provider records, normalized rows, skipped provider records and skipped normalized rows for future one-to-many imports.

### SportsDataIO NBA Player Stats Readiness V1

Status: Completed readiness and build verified; capped live pilot completed.

Evidence: `docs/sportsdataio-nba-player-stats-readiness-v1.md`, `src/services/sportsdataio-nba-player-stats-readiness.service.ts`, `/api/providers/sportsdataio/nba/player-stats/readiness`, `/api/providers/sportsdataio/nba/player-stats/migration-preflight`, `supabase/migrations/202607130002_sport_player_stats_v1.sql`, `src/services/provider-adapter-sdk.service.ts`, `src/services/sportsdataio-adapter-contract.service.ts` and `src/services/sportsdataio-runtime-adapter.service.ts`.

Note: The module adds the additive `sport_player_stats` persistence contract for player season and player game stat rows, corrects provider metadata so `player_stats` is distinct from roster `players`, validates deterministic fixture normalization and returns migration preflight queries plus go/no-go gates through readiness and direct migration-preflight APIs. The confirmed paths are `/v3/nba/stats/json/PlayerSeasonStats/{season}` and `/v3/nba/stats/json/PlayerGameStatsByDate/{date}`. It does not enable production confidence improvement.

### SportsDataIO NBA Player Stats Pilot V1

Status: Completed capped live trial import and build verified.

Evidence: `docs/sportsdataio-nba-player-stats-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/services/sportsdataio-nba-player-stats-readiness.service.ts`, `src/services/sportsdataio-nba-trial-isolation-audit.service.ts`, `/api/historical-import/execute`, `/api/nba/data-quality`, `/api/nba/features/preview`, `/api/nba/features/validation` and `supabase/migrations/202607130002_sport_player_stats_v1.sql`.

Note: The approved pilot called `PlayerSeasonStats/2026` and `PlayerGameStatsByDate/2025-12-26` sequentially with no retry and exactly 2 provider calls. It persisted 918 trial-isolated `sport_player_stats` rows, including 602 season rows and 316 game rows, plus 918 provider mappings. It preserved 203 unresolved player mappings safely, found zero unresolved teams/events, zero duplicate row IDs, zero duplicate mapping keys, zero trial-isolation violations and zero production leakage. Sync job `777f9ac7-efeb-4396-a007-259557dfdcf8` is completed after a local post-persistence audit compatibility fix; no provider retry was made.

### NBA Data Quality Player Stats Expansion V1

Status: Completed zero-call audit expansion and build verified.

Evidence: `docs/nba-data-quality-player-stats-expansion-v1.md`, `src/services/nba-data-quality.service.ts` and existing `/api/nba/data-quality`, `/api/nba/data-quality/issues`, `/api/nba/data-quality/coverage`, `/api/nba/reconciliation/plan` and `/api/nba/reconciliation/status` routes.

Note: The read-only NBA data-quality audit now includes player identity coverage, duplicate player keys, unresolved player-team links, optional `sport_player_stats` coverage, duplicate player-stat natural keys, missing event/team/player references, season mismatches and trial production-eligibility violations. If the additive `sport_player_stats` migration is not applied yet, the audit reports an informational unavailable-table issue instead of failing the whole quality report.

### NBA Player Stats Feature Quality Integration V1

Status: Completed zero-call Feature Store and data-quality integration; build verified.

Evidence: `src/services/feature-store-core.service.ts`, `src/services/multi-sport-feature-registry.service.ts`, `src/services/nba-feature-store-integration.service.ts`, `src/services/nba-data-quality.service.ts`, `src/components/dashboard/NbaFeatureStoreIntegrationPanel.tsx`, `/api/nba/features/store`, `/api/nba/features/preview`, `/api/nba/features/validation`, `/api/nba/data-quality`, `/api/nba/data-quality/coverage` and `/api/nba/data-quality/issues`.

Note: The module adds `player_stats_context` as an optional Feature Store feature, registers it for NBA moneyline/spread/total feature sets, reads stored `sport_player_stats` rows into NBA feature previews and dashboard summaries, and keeps trial player stats from improving production confidence. The existing NBA data-quality APIs now also audit stored injuries and lineups for unresolved mappings, stale feeds, duplicate lineup keys, invalid depth order and trial/production contamination. No routes, migrations or provider calls were added.

### NBA Daily Sync Orchestration Contract V1

Status: Completed zero-call orchestration contract and build verified.

Evidence: `src/services/nba-data-sync.service.ts`, `src/components/dashboard/NbaDataSyncPanel.tsx`, `/api/nba/sync/status` and `/api/nba/data-health`.

Note: The existing sync status and data-health responses now expose an ordered daily NBA workflow covering schedules, results, injuries, lineups, team stats, player stats, Feature Store preview, prediction preview, settlement and data-quality audit. The contract declares route, method, protection, mutation, checkpoint, idempotency key, provider-call default, concurrency and production safety gates for each step. No new route, provider call, migration or cosmetic dashboard module was added.

### NBA Daily Sync Orchestrator V2

Status: Completed compatibility-preserving dry-run/read-only orchestrator and build verified.

Evidence: `src/services/daily-pipeline.service.ts`, existing `/api/cron/daily-sync`, `/api/nba/features/preview`, `/api/nba/predictions`, `/api/nba/predictions/model-health` and `/api/nba/data-quality`.

Note: The existing cron route now accepts `version=2` to return `daily_sync_orchestrator_v2` with dry-run defaults, provider-call budget checks, concurrency `1`, no automatic retries, checkpoint/resume/cancel metadata and dependency-aware execution planning across the 10-step NBA workflow. Runtime validation used `dryRun=true` and `providerCallBudget=0`, returned 10 steps, made 0 provider calls, left production gates closed for trial-only or externally blocked domains and kept prediction persistence disabled.

### Historical Import Multi-Sport Planning V1

Status: Superseded by V2 additive planning contract and build verified.

Evidence: `src/services/historical-import-engine.service.ts`, existing `/api/historical-import/plan` and `docs/historical-import-engine-core-v1.md`.

Note: The existing historical import planner now returns `historical_import_multi_sport_planning_v2` for NBA, MLB, NFL, NHL and soccer without adding routes, migrations or provider calls. Each sport plan declares supported domains, dependency order, V2 domain manifests, destination tables, natural keys, conflict targets, request caps, provider-call accounting, record accounting, checkpoint/resume strategy, trial isolation defaults, data-quality/Feature Store/prediction-preview handoffs and sport-specific warnings. Domain manifests distinguish current API, recent historical feeds, archive-required, unsupported, entitlement-blocked, migration-pending and trial-only execution states without inventing endpoint paths. Live execution remains blocked pending provider, quota, exact endpoint/date-window and production-promotion approvals.

### Production Readiness Phase 1 - Historical Import Engine V2 Planning

Status: Completed first shared-layer increment and build verified.

Evidence: `src/services/historical-import-engine.service.ts`, existing `/api/historical-import/plan` and `docs/historical-import-engine-core-v1.md`.

Note: The V2 planning increment adds NBA to the shared multi-sport manifest, exposes a dependency graph, season/date/week/competition scope metadata, provider-call and maximum-record budgets, stable ID components, one-to-many expansion flags and deterministic validation for priority-sport coverage, concurrency `1`, retries disabled, trial isolation defaults, stable dependency indexes and nonnegative counters for the 39 provider records -> 758 normalized rows fixture. It makes zero provider calls, adds no API routes and creates no migration.

### Historical Feature Generation Orchestrator V1

Status: Completed dry-run contract and build verified; durable persistence handoff now uses runtime schema probing.

Evidence: `docs/historical-feature-generation-orchestrator-v1.md`, `src/services/historical-feature-generation.service.ts`, existing `/api/features/store/validation`, existing `/api/historical-import/plan`, `src/services/nba-data-sync.service.ts`, `src/services/daily-pipeline.service.ts` and `src/services/nba-backtesting-calibration.service.ts`.

Note: The orchestrator plans leakage-safe historical pregame feature snapshots from persisted normalized records only. It defines deterministic snapshot IDs, sport/event/market/cutoff/model/feature-set identity, trial/scrambled/production flags, lineage metadata, checkpoint/resume/cancel contracts, partial-failure isolation, nonnegative counters and a typed backtest input readiness contract. The deterministic suite covers leakage and persistence cases including cutoff inclusivity, post-cutoff rows, final scores, postgame player stats, injuries/lineups after cutoff, closing lines, trial rows in production generation, missing timestamps, deterministic regeneration, changed-lineage distinct keys, linked-snapshot immutability, batch dedupe, ROI/CLV blockers and cancellation/resume determinism. Runtime schema probing now distinguishes migration-file presence from remote schema application. Provider calls remain 0 and no route was added.

### Historical Feature Snapshot Persistence V1

Status: Implemented, runtime schema verified against the configured Supabase project and build verified.

Evidence: `supabase/migrations/202607140001_historical_feature_snapshots_v1.sql`, `docs/historical-feature-snapshot-persistence-v1.md`, `src/services/historical-feature-generation.service.ts`, existing `/api/features/store/validation`, existing `/api/historical-import/plan`, `src/services/nba-data-sync.service.ts`, `src/services/daily-pipeline.service.ts` and `src/services/nba-backtesting-calibration.service.ts`.

Note: The migration creates generic `historical_feature_snapshots` persistence and adds `prediction_history.feature_snapshot_id` plus companion lineage columns. Service contracts now use a server-only Supabase schema probe and report `applied` only when required tables/columns are selectable. The existing Feature Store route now supports a bounded write-mode pilot that inserted 15 NBA trial snapshots on first execution and reused all 15 on immediate rerun, with zero provider calls, zero duplicate rows and zero prediction mutations. Production backtesting, ROI, CLV and calibration remain blocked until real prediction rows are linked to durable snapshots and have valid prices, closing snapshots and sufficient settled production samples.

### Historical Feature Trial Lineage Pilot V1

Status: Completed as a bounded trial-only lineage verification and build verified.

Evidence: `docs/historical-feature-trial-lineage-pilot-v1.md`, `src/services/historical-feature-generation.service.ts`, existing `/api/features/store`, existing `/api/historical-import/plan`, `src/services/daily-pipeline.service.ts`, `src/services/nba-backtesting-calibration.service.ts` and `src/services/nba-prediction-settlement.service.ts`.

Note: The bounded pilot now prioritizes odds-enriched trial snapshots from the local snapshot pool while still considering at most 15 snapshots. After the corrected priced odds retry and legacy-moneyline cleanup, the first lineage execution found 5 eligible trial candidates, inserted 5 prediction rows, settled them locally as 3 wins and 2 losses, and the immediate rerun reused all 5 rows with 0 inserts. Provider calls remained 0. The rows remain `trial=true`, `scrambled=true`, `production_eligible=false`, so production recommendations, ROI, CLV, calibration, model promotion and confidence improvement remain blocked.

### NBA Trial Validation Batch V1

Status: Completed bounded technical trial validation and build verified.

Evidence: `docs/nba-trial-validation-batch-v1.md`, `src/services/historical-feature-generation.service.ts`, existing `/api/features/store`, existing `/api/nba/predictions/backtest`, existing `/api/settlement/core` and existing NBA market/readiness endpoints.

Note: The batch reused the existing Feature Store actions with no new routes, no migrations and 0 provider calls. It generated 27 market-specific trial snapshots across 9 completed SportsDataIO NBA events, verified snapshot idempotency by reusing all 27 on rerun, inserted 22 new trial predictions while reusing the 5 prior linked predictions, then reused all 27 on immediate prediction rerun. Final linked trial state is 27 settled predictions: 9 moneyline, 9 spread and 9 total, with 9 wins, 18 losses, 0 pushes, 0 voids, 0 duplicate prediction identities, 0 duplicate snapshot links and 0 production leakage. The result is technical trial validation only; production ROI, CLV, calibration and model promotion remain blocked.

### Settlement Core Multi-Sport Fixture Coverage V1

Status: Completed deterministic fixture expansion and build verified.

Evidence: `src/services/settlement-core.service.ts`, existing `/api/settlement/core` and `docs/settlement-core-v2.md`.

Note: The existing settlement core status now includes multi-sport deterministic fixtures for NBA, MLB, NFL, NHL and Soccer. It covers moneyline/spread/total equivalents, first-half/quarter/period contracts, overtime/extra-innings inclusion, push and void scenarios. Soccer draw, double chance, extra-time/penalties and two-leg aggregate remain contract-only when dedicated result-type metadata is missing. Props remain contract-only until grading feeds and settlement rules are proven. No route, provider call or migration was added.

### SportsDataIO NBA Player Props Readiness V1

Status: Completed zero-call readiness and build verified; live prop pilot blocked pending endpoint, market, entitlement and settlement confirmation.

Evidence: `docs/sportsdataio-nba-player-props-readiness-v1.md`, `src/services/sportsdataio-nba-player-props-readiness.service.ts`, `/api/providers/sportsdataio/nba/player-props/readiness`, `/api/providers/sportsdataio/nba/player-props/endpoint-preflight`, `src/services/provider-adapter-sdk.service.ts`, `src/services/sportsdataio-adapter-contract.service.ts`, `src/services/sportsdataio-runtime-adapter.service.ts` and `src/services/historical-import-engine.service.ts`.

Note: The module adds `player_props` to contract/runtime/import-planning readiness and validates a deterministic local over/under prop fixture with zero provider calls. It now returns endpoint and settlement preflight gates through readiness and direct endpoint-preflight APIs. It uses existing `sports_odds_snapshots` as the future persistence target with player/event metadata, creates no migration and keeps production prediction, backtesting, model training and settlement disabled.

### SportsDataIO NBA Odds Readiness V1

Status: Completed zero-call readiness and build verified.

Evidence: `docs/sportsdataio-nba-odds-readiness-v1.md`, `src/services/sportsdataio-nba-odds-readiness.service.ts`, `/api/providers/sportsdataio/nba/odds/readiness`, `/api/providers/sportsdataio/nba/odds/endpoint-preflight` and existing `sports_odds_snapshots` migration `supabase/migrations/202607110001_nba_data_sync_v1.sql`.

Note: The module validates deterministic moneyline, spread and total odds rows for future `sports_odds_snapshots` persistence with zero provider calls and no migration. It now returns endpoint and entitlement preflight gates through readiness and direct endpoint-preflight APIs. Live odds and historical odds execution remain blocked until exact authenticated endpoint paths, entitlement, sportsbook coverage and capped historical windows are approved.

### SportsDataIO NBA Betting Events And Odds Contract Pilot V1

Status: Completed discovery-only verification and build verified.

Evidence: `docs/sportsdataio-nba-odds-readiness-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/config/sportsdataio-endpoint-catalog.ts`, existing `/api/historical-import/execute` and existing `sports_odds_snapshots` persistence contract.

Note: The approved pilot used `maximumRequests=2`, concurrency `1`, no retries, `trial=true`, `scrambled=true` and `production_eligible=false`. `BettingEventsByDate/2025-12-26` returned HTTP 200 with 9 records and nested `BettingMarkets` discovery metadata. The approved one-event follow-up `BettingMarkets/22888` returned HTTP 200 with 0 records. The executor now treats this honestly as discovery/index data, completed sync job `1a72e504-9737-4dd0-9b9e-8fd722b51c05`, persisted no unsupported odds snapshots, created no migration and kept production predictions, CLV, ROI, backtesting, calibration and model training disabled. The supplied `LveGameOddsByDate` path and broad alternate-market endpoint remain uncalled.

### SportsDataIO NBA Priced Game Odds Pilot V1

Status: Corrected priced odds, legacy cleanup and trial lineage verification complete for the approved scope.

Evidence: `docs/sportsdataio-nba-priced-game-odds-pilot-v1.md`, `src/services/sportsdataio-historical-import-readiness.service.ts`, existing `/api/historical-import/execute` and existing `sports_odds_snapshots` persistence.

Note: `GameOddsByDate/2025-12-26` returned HTTP 200 with 9 game records. The first run persisted 1,476 trial/scrambled/non-production odds rows and recorded `records_skipped=0`. The approved cleanup deleted only 936 unintended `AlternateMarketPregameOdds` rows. The approved corrected one-call retry inserted 180 null-line moneyline replacements and updated 360 spread/total rows, then the approved supersession cleanup deleted exactly 180 legacy non-null-line moneylines after verifying 180 corrected replacements and 0 feature-snapshot/prediction references. Final stored SportsDataIO trial odds are 540 rows: 180 moneyline, 180 spread and 180 total, with 0 legacy moneylines, 0 duplicate logical rows and 0 production leakage.

### SportsDataIO Canonical Endpoint Catalog V1

Status: Completed provider-independent catalog and build verified.

Evidence: `src/config/sportsdataio-endpoint-catalog.ts` and `docs/providers/sportsdataio/`.

Note: The catalog records exact path templates, API version, domain, parameter format, production/historical purpose, trial status, entitlement status, implementation status, normalization status, persistence status and last pilot status for the SportsDataIO feeds Pick Analyzer actually needs across NBA, MLB, NFL, NHL and Soccer. It adds no route, performs no provider call and does not unlock production use.

### SportsDataIO MLB Discovery Lab Variant Correction V1

Status: Completed route-family correction and auth probe; import execution blocked pending exact endpoint confirmation.

Evidence: `src/config/sportsdataio-endpoint-catalog.ts`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/services/multi-sport-providers.service.ts`, `src/services/historical-import-engine.service.ts`, `docs/providers/sportsdataio/MLB.md` and `docs/providers/sportsdataio/CAPABILITY_MATRIX.md`.

Note: The purchased personal-use MLB subscription is modeled as `sportsdataio_discovery_lab`, using `https://api.sportsdata.io/api/mlb/{product}/json/{endpoint}` with `SPORTSDATAIO_MLB_API_KEY` and the `Ocp-Apim-Subscription-Key` header. `GET /api/mlb/fantasy/json/CurrentSeason` returned HTTP 200 as a sanitized auth/capability probe. Enterprise `/v3/mlb/...` paths remain cataloged separately but are not executable with the Discovery Lab key, and the Historical Import planner blocks MLB live import domains until exact Discovery Lab Fantasy/Odds endpoints are confirmed.

### SportsDataIO MLB Real Data Validation Batch V1

Status: Completed for quarantined teams, players, events and stats; odds/feature handoff blocked; build verified.

Evidence: `docs/mlb-real-data-validation-batch-v1.md`, `src/config/sportsdataio-endpoint-catalog.ts`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/services/historical-import-engine.service.ts`, `docs/providers/sportsdataio/MLB.md` and `docs/providers/sportsdataio/CAPABILITY_MATRIX.md`.

Note: The confirmed Discovery Lab Fantasy + Odds endpoint catalog now includes Teams, Players, FreeAgents, Standings, DFS slates, player game/season stats, player projections, GamesByDate, GameOddsByDate, GameOddsLineMovement, Games, Stadiums, TeamGameStatsByDate and TeamSeasonStats. Batch V1 first identified `2026-07-12` as the viable date, then fixed the `sport_player_stats` preflight blocker caused by oversized `.in()` chunks. The corrected retry used 5 provider calls, all HTTP 200, and inserted 30 teams, 7,258 players, 15 events, 30 team game stats, 463 player game stats, 7,796 provider mappings and 1 sync job as quarantined non-production rows. The approved odds-only retry fixed `GameId`/`GameID` and nested `PregameOdds` normalization, used 1 provider call to `GameOddsByDate/2026-07-12`, returned HTTP 200 with 15 records, inserted 90 quarantined full-game odds rows and completed sync job `4214c5a3-38de-41c8-9f53-7eab1714a34f`. Feature snapshots, predictions, settlement, backtest and production promotion remain blocked because 0 persisted odds rows were timestamp-safe relative to stored event starts.

Line Movement Probe V1 selected mapped completed GameId `78723` and used exactly 1 provider call to `GameOddsLineMovement/78723`. The endpoint returned HTTP 200 with 624 nested movement snapshots, inserted 3,720 quarantined timestamp-aware odds rows, found 2,586 cutoff-safe rows before the 10-minute pregame cutoff and completed sync job `56db235c-8837-426f-8e84-e6e0ebc70a97`. The approved one-game MLB lineage extension then used 0 provider calls and the existing Feature Store route actions to insert 3 quarantined feature snapshots, reuse all 3 on rerun, insert 3 linked predictions, reuse all 3 on rerun, and settle the bounded moneyline, spread/run-line and total rows. MLB Line Movement Expansion Batch V1 then used exactly 14 additional sequential provider calls for the remaining `2026-JUL-12` events, all HTTP 200, inserted 32,722 new line-movement rows, and produced full-date coverage of 36,442 line-movement rows with 25,498 cutoff-safe rows. The bounded multi-game Feature Store lineage run inserted 42 new snapshots plus reused 3, inserted 42 new predictions plus reused 3, settled 45 technical predictions as 21 wins and 24 losses, and reran idempotently with 45 reused rows. The rows remain `trial=false`, `scrambled=false`, `production_eligible=false`, recommended picks are 0, production leakage is 0 and production CLV remains blocked.

MLB Prospective Validation Day 1 Readiness V1 completed the zero-provider-call operations pass after the historical validation date. The existing `/api/cron/daily-sync?version=2` response now carries the disabled Day 1 MLB workflow, Puerto Rico capture windows, conservative 6/8/12 daily call budget, event-aware cutoff policy, technical closing-comparison contract, recovery/checkpoint guidance and acceptance packet. The existing `/api/daily-report` response now carries a labeled `mlbValidation` section for pregame/postgame/30-day report fields while public top-pick sections remain filtered to production-eligible rows. No new route, dashboard, migration, provider call, recurring schedule, model training or production promotion was added.

MLB Historical Recommendation Replay V1 then exposed the already-settled July 12 validation rows for product inspection without generating new predictions. The existing `/api/predictions/by-sport` route now supports explicit `historicalValidation=true&validationMode=quarantined&sport=baseball_mlb&date=2026-07-12`, returning only the 45 linked Feature Store lineage predictions with 21 wins, 24 losses, 0 pushes, 0 production-eligible rows and 0 provider calls. The existing MLB Prediction Engine panel renders the replay with market/result/confidence/matchup filters, chronological default sorting, final score/settlement display and compact pregame lineage explanations. Default production-facing calls still exclude quarantined rows.

### SportsDataIO Betting Market Normalization Core V1

Status: Completed provider-independent normalization/routing hardening and build verified.

Evidence: `src/services/sportsdataio-betting-normalizer.service.ts`, `src/services/sportsdataio-historical-import-readiness.service.ts`, `src/services/sportsdataio-runtime-adapter.service.ts`, `src/config/sportsdataio-endpoint-catalog.ts` and `docs/providers/sportsdataio/`.

Note: The shared normalizer separates `BettingEventID`, `GameID`, `BettingMarketID`, `BettingOutcomeID` and `SportsbookID`, classifies payloads as `DISCOVERY_ONLY`, `MARKET_INDEX_AVAILABLE`, `PRICED_OUTCOMES_AVAILABLE`, `ARCHIVE_REQUIRED`, `ENTITLEMENT_BLOCKED`, `EMPTY_VALID_RESPONSE` or `UNSUPPORTED_SCHEMA`, and preserves provider-record, event, market, outcome, sportsbook, priced-outcome and normalized-snapshot counters. Runtime capabilities now include a zero-call `betting_metadata` domain for BettingMetadata and ActiveSportsbooks contracts. No provider calls, routes or migrations were added.

### SportsDataIO NBA Integration Readiness V1

Status: Completed zero-call aggregate readiness and build verified.

Evidence: `docs/sportsdataio-nba-integration-readiness-v1.md`, `src/services/sportsdataio-nba-integration-readiness.service.ts`, `src/components/dashboard/HistoricalImportEnginePanel.tsx`, `/api/providers/sportsdataio/nba/readiness`, `/api/providers/sportsdataio/nba/provider-gate`, `/api/providers/sportsdataio/nba/external-blockers`, `/api/providers/sportsdataio/nba/blocker-resolution`, `/api/providers/sportsdataio/nba/production-gate`, `/api/providers/sportsdataio/nba/production-usage-exclusion`, `/api/providers/sportsdataio/nba/domain-proof`, `/api/providers/sportsdataio/nba/completion-evidence`, `/api/providers/sportsdataio/nba/objective-audit`, `/api/providers/sportsdataio/nba/safe-next-actions`, `/api/providers/sportsdataio/nba/evidence-export`, `/api/providers/sportsdataio/nba/next-pilot-preflight`, `/api/providers/sportsdataio/nba/approval-packet`, `/api/providers/sportsdataio/nba/completion-audit`, `/api/providers/sportsdataio/nba/contract-audit`, runtime capabilities/status routes and NBA odds/player-props/player-stats readiness services including `/api/providers/sportsdataio/nba/odds/endpoint-preflight`, `/api/providers/sportsdataio/nba/player-props/endpoint-preflight` and `/api/providers/sportsdataio/nba/player-stats/migration-preflight`.

Note: The module aggregates local runtime validation, capability metadata and NBA readiness services into one blocker and safety-invariant report. `/api/providers/sportsdataio/nba/readiness` is the canonical readiness surface for new consumers. Focused domain-proof, completion-evidence, objective-audit and safe-next-actions routes remain compatibility aliases that preserve their response contracts while identifying the canonical readiness section; odds/player-props endpoint preflights and player-stats migration preflight remain operational aliases for focused approval checks. The aggregate response now carries next-pilot preflight summaries so the Historical Import dashboard can render one Readiness Summary and next-pilot gates without fetching duplicate domain readiness endpoints. It still includes the handoff matrix, production gates, safe next actions, objective completion audit, external blocker ledger and route, validated readiness evidence export and route, production gate audit, provider execution gate and route, external blocker resolution checklist, production usage exclusion audit and route, next-pilot approval checklist, next-pilot preflight route, external approval packet, blocked-state audit, contract-audit route, domain completion proof ledger, completion evidence matrix, response-shape audit and surface consistency audit. It makes zero provider calls, exposes no secrets and reports the integration as ready with external blockers rather than production-ready for uncapped provider execution.

Blocker Resolution API V1 adds `/api/providers/sportsdataio/nba/blocker-resolution` as the direct zero-call route for the external blocker resolution checklist. Historical Import and Runtime Observability now display the resolution route, and surface consistency requires the blocker-resolution route across operator surfaces.

Production Gate API V1 adds `/api/providers/sportsdataio/nba/production-gate` as the direct zero-call route for the production gate audit. Historical Import and Runtime Observability now display the production gate route, and surface consistency requires the production-gate route across operator surfaces.

Domain Proof API V1 adds `/api/providers/sportsdataio/nba/domain-proof` as the direct zero-call route for the domain completion proof ledger. Historical Import and Runtime Observability now display the domain proof route, and surface consistency requires the domain-proof route across operator surfaces.

Completion Evidence API V1 adds `/api/providers/sportsdataio/nba/completion-evidence` as the direct zero-call route for the completion evidence matrix. Historical Import and Runtime Observability now display the completion evidence route, and surface consistency requires the completion-evidence route across operator surfaces.

Objective Audit API V1 adds `/api/providers/sportsdataio/nba/objective-audit` as the direct zero-call route for objective-level remaining work and completion blockers. Historical Import and Runtime Observability now display the objective audit route, and surface consistency requires the objective-audit route across operator surfaces.

Safe Next Actions API V1 adds `/api/providers/sportsdataio/nba/safe-next-actions` as the direct zero-call route for allowed local next actions and still-closed production gates. Historical Import and Runtime Observability now display the safe-next-actions route, and surface consistency requires the route across operator surfaces.

### NBA Stored Lineup Feature Enrichment V1

Status: Completed zero-call feature enrichment and build verified.

Evidence: `src/services/nba-feature-store-integration.service.ts`, `src/services/nba-injury-lineup-confidence.service.ts`, `docs/PROJECT_STATUS.md` and existing NBA feature preview/validation APIs.

Note: The NBA Feature Store preview now uses stored `sport_lineups` sample size, freshness and provenance when lineup/depth rows exist. Trial/scrambled lineup rows remain excluded from production confidence improvement and continue to apply conservative confidence penalties.

### SportsDataIO NBA Trial Isolation Audit V1

Status: Completed read-only audit surface and build verified.

Evidence: `docs/sportsdataio-nba-trial-isolation-audit-v1.md`, `src/services/sportsdataio-nba-trial-isolation-audit.service.ts`, `/api/providers/sportsdataio/nba/trial-isolation` and `prediction_history` trial leakage checks.

Note: The audit scans stored SportsDataIO NBA rows for trial/scrambled metadata and `production_eligible=false`, tolerates optional `sport_player_stats` absence and checks that NBA prediction rows do not reference SportsDataIO trial events or carry trial feature markers.

### SportsDataIO NBA Observability Integration V1

Status: Completed zero-call runtime and dashboard observability extension; build verified.

Evidence: `docs/sportsdataio-nba-observability-integration-v1.md`, `src/services/runtime-observability.service.ts`, `src/components/dashboard/RuntimeObservabilityPanel.tsx`, `/api/observability/runtime`, `src/services/sportsdataio-nba-integration-readiness.service.ts` and `src/services/sportsdataio-nba-trial-isolation-audit.service.ts`.

Note: Runtime Observability V1 now exposes and displays a nested SportsDataIO NBA section with readiness blockers, external blocker ledger summaries and blocker route, readiness evidence export validation and route, production gate audit status, provider execution gate status and route, external blocker resolution checklist status, execution-readiness validation status, production usage exclusion audit status and route, next-pilot approval checklist status and preflight route, external approval packet status, blocked-state audit status, domain completion proof ledger status, completion evidence matrix status, response-shape audit status and contract route, surface consistency audit status and contract route, readiness-area summaries, trial-isolation totals, prediction leakage counts and safety invariants. The ledger summary preserves zero pre-approval provider calls and closed production gate visibility from the aggregate readiness endpoint, and the blocker route, evidence export validation/route, production gate audit, provider execution gate route, external blocker resolution checklist, execution-readiness validation, production usage exclusion route, next-pilot approval checklist/preflight route, external approval packet, blocked-state audit, domain completion proof ledger, completion evidence matrix, response-shape audit plus surface consistency audit give runtime observability consumer checks for the handoff packet. The extension makes zero provider calls, adds no migration and performs no mutations.

### Feature Store Core V1

Status: Completed computed architecture and build verified.

Evidence: `docs/feature-store-core-v1.md`, `src/services/feature-store-core.service.ts`, `/api/features/store`, `/api/features/store/definitions`, `/api/features/store/validation` and `FeatureStoreCorePanel`.

Note: The module defines versioned feature definitions, computed pre-event snapshots, freshness, provenance, sample size, data quality, cutoff timestamps, invalidation keys and deterministic leakage validation without persistence or provider calls.

### Multi-Sport Feature Registry V1

Status: Completed provider-independent registry and build verified.

Evidence: `docs/multi-sport-feature-registry-v1.md`, `src/services/multi-sport-feature-registry.service.ts`, `/api/features/registry`, `/api/features/registry/lookup`, `/api/features/registry/validation` and `MultiSportFeatureRegistryPanel`.

Note: The module maps feature definitions into sport, market and model-specific feature sets with readiness states and fallback policies. Unsupported sport-specific feature domains remain explicit warnings.

### NBA Feature Store Integration V1

Status: Completed read-only integration and build verified.

Evidence: `docs/nba-feature-store-integration-v1.md`, `src/services/nba-feature-store-integration.service.ts`, `/api/nba/features/store`, `/api/nba/features/preview`, `/api/nba/features/validation` and `NbaFeatureStoreIntegrationPanel`.

Note: The module validates NBA feature-set compatibility with Feature Store Core and existing `prediction_history.feature_snapshot` without changing NBA prediction generation or requiring a migration.

### Shared Sport Prediction Engine SDK V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/shared-sport-prediction-engine-sdk-v1.md`, `src/services/sport-prediction-engine-sdk.service.ts`, `/api/prediction-sdk`, `/api/prediction-sdk/validation` and `SportPredictionSdkPanel`.

Note: The module defines reusable sport engine strategy, normalized input/output, market capability, probability, fair odds, edge, expected value, confidence, uncertainty, recommendation, explanation, warning, Kelly, Smart Ranking, Monte Carlo, persistence, settlement and model health contracts. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### MLB Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/mlb-feature-store-integration-v1.md`, `src/services/mlb-feature-store-integration.service.ts`, `/api/mlb/features/store`, `/api/mlb/features/preview`, `/api/mlb/features/validation` and `MlbFeatureStoreIntegrationPanel`.

Note: The module validates MLB Feature Store compatibility without provider calls or migrations. The MLB moneyline feature set remains `partial` because probable pitcher, confirmed lineup, weather, park-factor and advanced-stat domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### MLB Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/mlb-prediction-engine-v1.md`, `src/services/mlb-prediction-engine.service.ts`, `/api/mlb/predictions`, `/api/mlb/predictions/health`, `/api/mlb/predictions/validation` and `MlbPredictionEnginePanel`.

Note: The module produces deterministic moneyline, spread/run line and total previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NFL Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/nfl-feature-store-integration-v1.md`, `src/services/nfl-feature-store-integration.service.ts`, `/api/nfl/features/store`, `/api/nfl/features/preview`, `/api/nfl/features/validation` and `NflFeatureStoreIntegrationPanel`.

Note: The module validates NFL Feature Store compatibility without provider calls or migrations. The NFL spread feature set remains `partial` because quarterback impact, injury impact, weather and rest/travel domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NFL Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/nfl-prediction-engine-v1.md`, `src/services/nfl-prediction-engine.service.ts`, `/api/nfl/predictions`, `/api/nfl/predictions/health`, `/api/nfl/predictions/validation` and `NflPredictionEnginePanel`.

Note: The module produces deterministic moneyline, spread, total and first-half previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Soccer Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/soccer-feature-store-integration-v1.md`, `src/services/soccer-feature-store-integration.service.ts`, `/api/soccer/features/store`, `/api/soccer/features/preview`, `/api/soccer/features/validation` and `SoccerFeatureStoreIntegrationPanel`.

Note: The module validates soccer Feature Store compatibility without provider calls or migrations. The soccer moneyline feature set remains `partial` because draw-aware context, league strength, confirmed lineup and injury domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Soccer Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/soccer-prediction-engine-v1.md`, `src/services/soccer-prediction-engine.service.ts`, `/api/soccer/predictions`, `/api/soccer/predictions/health`, `/api/soccer/predictions/validation` and `SoccerPredictionEnginePanel`.

Note: The module produces deterministic 1X2, double chance, draw no bet, totals, BTTS, first-half, qualification and Asian handicap contract previews. It validates three-way probability normalization and no-vig behavior, does not persist picks, consumes zero provider calls and does not claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NHL Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/nhl-feature-store-integration-v1.md`, `src/services/nhl-feature-store-integration.service.ts`, `/api/nhl/features/store`, `/api/nhl/features/preview`, `/api/nhl/features/validation` and `NhlFeatureStoreIntegrationPanel`.

Note: The module validates NHL Feature Store compatibility without provider calls or migrations. The NHL moneyline feature set remains `partial` because starting goalie, goalie form, injury impact, special-teams and rest/travel domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### NHL Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/nhl-prediction-engine-v1.md`, `src/services/nhl-prediction-engine.service.ts`, `/api/nhl/predictions`, `/api/nhl/predictions/health`, `/api/nhl/predictions/validation` and `NhlPredictionEnginePanel`.

Note: The module produces deterministic moneyline, puck line/spread and total previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Tennis Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/tennis-feature-store-integration-v1.md`, `src/services/tennis-feature-store-integration.service.ts`, `/api/tennis/features/store`, `/api/tennis/features/preview`, `/api/tennis/features/validation` and `TennisFeatureStoreIntegrationPanel`.

Note: The module validates tennis Feature Store compatibility without provider calls or migrations. The tennis moneyline feature set remains `partial` because player form, surface, ranking and injury domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### Tennis Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/tennis-prediction-engine-v1.md`, `src/services/tennis-prediction-engine.service.ts`, `/api/tennis/predictions`, `/api/tennis/predictions/health`, `/api/tennis/predictions/validation` and `TennisPredictionEnginePanel`.

Note: The module produces deterministic match-winner and match-total previews through the Shared Sport Prediction Engine SDK. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### UFC Feature Store Integration V1

Status: Completed provider-independent integration and build verified.

Evidence: `docs/ufc-feature-store-integration-v1.md`, `src/services/ufc-feature-store-integration.service.ts`, `/api/ufc/features/store`, `/api/ufc/features/preview`, `/api/ufc/features/validation` and `UfcFeatureStoreIntegrationPanel`.

Note: The module validates UFC Feature Store compatibility without provider calls or migrations. The UFC moneyline feature set remains `partial` because fighter form, camp, injury, method and weigh-in domains are explicit missing-domain warnings. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

### UFC Prediction Engine V1

Status: Completed provider-independent architecture and deterministic validation verified.

Evidence: `docs/ufc-prediction-engine-v1.md`, `src/services/ufc-prediction-engine.service.ts`, `/api/ufc/predictions`, `/api/ufc/predictions/health`, `/api/ufc/predictions/validation` and `UfcPredictionEnginePanel`.

Note: The module produces deterministic fight-winner and method-contract previews through the Shared Sport Prediction Engine SDK. Moneyline is settlement-compatible; method contracts are explicitly not settlement-compatible until combat-specific grading exists. It does not persist picks, consume provider calls or claim production betting readiness. Completion labels are `ARCHITECTURE_COMPLETE`, `DETERMINISTIC_VALIDATION_COMPLETE`, `REAL_DATA_VALIDATION_PENDING` and `HISTORICAL_CALIBRATION_PENDING`.

## Next Modules In Dependency Order

### 1. Provider-Backed NBA Data Quality And Historical Reconciliation Phase B

Status: Blocked until explicit provider/quota/date-window approval.

Objective: Execute capped, provider-backed reconciliation using the Phase A dry-run plan, improving NBA event/result/odds coverage without full historical downloads.

Prerequisites: NBA Data Quality and Historical Reconciliation Phase A, SportsDataIO NBA Pilot Import V1, SportsDataIO NBA Pilot Import V2, provider quota approval, credentials available and capped date windows approved.

Backend scope: Provider-backed incremental reconciliation jobs, small date-window execution, idempotent refreshes, duplicate handling and reconciliation status tracking.

Frontend scope: Extend the data quality dashboard with explicitly authorized execution controls, progress and post-run deltas.

Persistence or migration scope: Additive reconciliation job metadata only if existing `sports_sync_jobs` metadata is insufficient.

APIs: Extend `/api/nba/reconciliation/*` with protected execution endpoints while preserving existing dry-run contracts.

Validation: Use small date ranges first; never run full historical sync without approval; confirm no provider quota overrun.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Approved gaps can be refreshed idempotently, data quality improves, and provider calls stay within the approved cap.

### 2. Injury Provider Integration

Status: Partially satisfied by SportsDataIO NBA Injuries Pilot V1 and NBA Injury and Lineup Confidence Integration V1; production-eligible injury ingestion remains pending.

Objective: Add a real production-eligible provider-backed injury ingestion path.

Prerequisites: Provider selected, credentials available, production-eligible data contract reviewed.

Backend scope: Provider client, normalizer, sync job and persistence into `sport_injuries`.

Frontend scope: NBA health and prediction panels show injury freshness and coverage.

Persistence or migration scope: Additive columns only if provider fields require them.

APIs: NBA injury sync and health endpoints may be extended.

Validation: Verify no fabricated injuries; unsupported provider states return warnings.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Production-eligible injury data can be synced idempotently and used as a feature input without trial-data confidence leakage.

### 3. Expected Lineups

Objective: Integrate real expected/confirmed lineup data for NBA.

Prerequisites: NBA Injury and Lineup Confidence Integration V1 plus exact expected/confirmed lineup provider endpoint and entitlement confirmation.

Backend scope: Lineup provider, normalizer, sync, confidence status and freshness.

Frontend scope: Lineup status in NBA dashboard.

Persistence or migration scope: Use `sport_players` and add lineup table only if needed.

APIs: NBA lineups sync/query endpoints.

Validation: No fake lineups; stale/unavailable lineups produce warnings.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Lineup data is auditable and safely consumed by predictions.

### 4. Closing Line Value AI V2

Objective: Upgrade CLV intelligence using settled predictions and odds movement.

Prerequisites: Settlement, multi-book comparison and odds history.

Backend scope: CLV V2 scoring, sportsbook timing analysis and model feedback.

Frontend scope: Enhanced CLV dashboard.

Persistence or migration scope: Additive CLV metadata only if necessary.

APIs: Extend closing-line intelligence APIs.

Validation: Verify against stored opening/closing snapshots.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: CLV outputs are auditable and integrated with model health.

### 5. NBA Prediction Engine V2

Objective: Improve NBA predictions using calibrated features, quality checks and provider-backed context.

Prerequisites: Backtesting/calibration, data quality, injury/lineup provider readiness and odds quality.

Backend scope: Feature upgrades, calibrated probabilities, market-specific confidence and EV refinement.

Frontend scope: V2 model health and explanation updates.

Persistence or migration scope: Model version metadata only if needed.

APIs: Preserve V1 contracts or version explicitly.

Validation: Compare V2 to V1 without overwriting historical V1 records.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: V2 demonstrates measurable improvement or clearly documented tradeoffs.

### 6. Prop Bets Engine

Objective: Add player prop predictions only after player, injury and lineup data are real.

Prerequisites: Real player rosters, injuries, lineups and prop odds.

Backend scope: Player feature engineering, prop market normalization and settlement rules.

Frontend scope: Prop dashboard and explanation cards.

Persistence or migration scope: Player prop prediction and settlement metadata if not covered by existing tables.

APIs: Prop prediction and performance endpoints.

Validation: No props without real provider data.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Prop predictions are validated, persisted and settleable.

### 7. Same Game Parlays

Objective: Build correlation-aware same-game parlay recommendations.

Prerequisites: Prop engine, market correlation service and settlement coverage.

Backend scope: Correlation model, eligibility rules and EV calculation.

Frontend scope: Same-game parlay builder.

Persistence or migration scope: Parlay legs and recommendation history if needed.

APIs: Same-game parlay endpoints.

Validation: Prevent unsupported or unavailable leg combinations.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: SGP recommendations are explainable and risk-bounded.

### 8. Portfolio Optimizer V3

Objective: Upgrade portfolio allocation using calibrated NBA performance and cross-market risk.

Prerequisites: Settled predictions, calibration and market performance.

Backend scope: Allocation V3, exposure constraints and scenario simulation.

Frontend scope: Portfolio V3 panel.

Persistence or migration scope: Optional portfolio run history.

APIs: Portfolio V3 endpoint.

Validation: Verify bankroll constraints and no over-allocation.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Portfolio outputs are consistent with Kelly/risk services.

### 9. Bankroll AI

Objective: Add adaptive bankroll guidance from settled performance and risk profile.

Prerequisites: Portfolio V3 and performance history.

Backend scope: Bankroll policy, drawdown rules and stake recommendations.

Frontend scope: Bankroll AI panel.

Persistence or migration scope: User bankroll settings if supported.

APIs: Bankroll AI endpoint.

Validation: Conservative defaults and risk bounds.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Guidance is explainable and never exceeds configured constraints.

### 10. Arbitrage Finder

Objective: Detect cross-book arbitrage from multi-book odds.

Prerequisites: Multi-book comparison with fresh odds.

Backend scope: Arbitrage scanner and stale odds guardrails.

Frontend scope: Arbitrage opportunities panel.

Persistence or migration scope: Optional opportunity snapshots.

APIs: Arbitrage endpoint.

Validation: Verify math, freshness and bookmaker coverage.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Only real, fresh odds produce opportunities.

### 11. NBA Complete

Objective: Declare NBA production-complete after sync, predictions, validation, settlement, calibration, injury/lineup context and dashboards are reliable.

Prerequisites: NBA modules above.

Backend scope: Hardening and monitoring.

Frontend scope: Final NBA dashboard polish.

Persistence or migration scope: None unless hardening requires additive metadata.

APIs: Stable NBA API contracts.

Validation: Full smoke suite with real available data.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: NBA can run daily without manual intervention except provider outages.

### 12. NFL Complete

Objective: Apply the proven NBA pattern to NFL.

Prerequisites: NBA complete and multi-sport abstractions validated.

Backend scope: NFL sync, features, prediction, validation and settlement.

Frontend scope: NFL dashboard surfaces.

Persistence or migration scope: Reuse generic sports tables where possible.

APIs: NFL or generic sports endpoints.

Validation: Provider-backed NFL smoke tests.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: NFL has production-ready sync-to-settlement flow.

### 13. Soccer Complete

Objective: Add soccer league-specific prediction and settlement support.

Prerequisites: Provider league selection and soccer market definitions.

Backend scope: Soccer sync, draw-aware markets, xG or provider-backed features.

Frontend scope: Soccer dashboard.

Persistence or migration scope: Reuse generic tables where possible.

APIs: Soccer endpoints through multi-sport routes.

Validation: Draw/no-draw settlement and market-specific checks.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Soccer coverage is league-aware and settleable.

### 14. NHL Complete

Objective: Add NHL prediction and settlement support.

Prerequisites: Multi-sport pattern and hockey-specific feature source.

Backend scope: NHL sync, goalie/context features and settlement.

Frontend scope: NHL dashboard.

Persistence or migration scope: Reuse generic tables where possible.

APIs: NHL endpoints through multi-sport routes.

Validation: Hockey market settlement and provider freshness.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: NHL has production-ready sync-to-settlement flow.

### 15. Tennis

Objective: Add tennis match prediction support.

Prerequisites: Individual-participant adapter readiness.

Backend scope: Player-form features, tournament events and match settlement.

Frontend scope: Tennis dashboard.

Persistence or migration scope: Player/participant records as needed.

APIs: Tennis endpoints through multi-sport routes.

Validation: Individual participant settlement and tournament status handling.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Tennis predictions are provider-backed and settleable.

### 16. UFC

Objective: Add UFC fight prediction support.

Prerequisites: Fighter data provider and event-based schedule support.

Backend scope: Fighter records, market settlement and event health.

Frontend scope: UFC dashboard.

Persistence or migration scope: Fighter metadata if needed.

APIs: UFC endpoints through multi-sport routes.

Validation: Event/fight settlement and method market guardrails.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: UFC predictions are provider-backed and settleable.

### 17. Live Betting AI

Objective: Add live betting intelligence only after pregame pipelines are reliable.

Prerequisites: Stable odds feeds, model calibration, bankroll constraints and settlement.

Backend scope: Live odds ingestion, momentum, cash-out and hedge intelligence.

Frontend scope: Live betting panel hardening.

Persistence or migration scope: Live snapshots if needed.

APIs: Live betting endpoints.

Validation: Strict stale data and latency warnings.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: Live recommendations are latency-aware and risk-bounded.

### 18. Prediction Engine V5

Objective: Upgrade the general prediction engine after sport-specific calibration exists.

Prerequisites: Settled/calibrated data across multiple sports.

Backend scope: Cross-sport model improvements and versioned comparison to V4.

Frontend scope: Model center V5 comparison and rollout controls.

Persistence or migration scope: Model version metadata and rollout history if needed.

APIs: Versioned prediction endpoint or backwards-compatible V4 extension.

Validation: Backtest, calibration, rollback and A/B comparison.

Build criteria: `npm.cmd run build` exits 0.

Completion criteria: V5 is demonstrably better or safely feature-flagged.

### 19. MLB Operating Day Lifecycle V1

Objective: Run each MLB operating day as a deterministic, auditable lifecycle.

Status: Implemented. Additive persistence, orchestrator routes, result-sync resilience, scoped settlement, replay report scaffolding, provider-call accounting and dashboard status panel are in place.

Backend scope: `operating-day.service.ts`, `/api/operating-day/execute`, `/api/operating-day/status`, `/api/operating-day/[operatingDayId]/settle`, `/api/operating-day/validation`, final-refresh fix in the SportsDataIO MLB prospective preview path and structured `/api/results/sync`.

Frontend scope: Compact dashboard Operating Day panel in Today.

Persistence or migration scope: `202607170001_mlb_operating_day_lifecycle_v1.sql`.

Validation: `npm.cmd run build` exits 0. Deterministic route compiles and exposes local settlement/freeze fixtures with zero provider calls.

Completion criteria: Daily actions can be dry-run with zero provider calls, final refresh no longer depends on schedule rediscovery, quota-blocked result sync is explicit, and settlement can be scoped by operating day without touching the historical backlog.

### 20. MLB Next Slate Rollover V1

Objective: Prevent started or completed MLB slates from remaining on active betting surfaces and prepare the next future slate safely.

Status: Implemented as a focused rollover correction. Shared active-event rules, stored-data next-slate status, Current Board rollover, MLB prospective-preview filtering and a compact dashboard Next Slate panel are in place.

Backend scope: `active-event.service.ts`, `next-slate.service.ts`, `/api/slate/next/status`, operating-day planning actions `resolve_next_slate`, `next_slate_preview`, `prepare_next_slate` and `postgame_rollover`.

Frontend scope: Compact dashboard Next Slate panel and slate-aware MLB prospective preview empty state.

Persistence or migration scope: None. The patch uses stored `sport_events`, `sports_odds_snapshots` and `prediction_history` only.

Validation: `npm.cmd run build` exits 0. Stored validation selected `2026-07-17` as the next MLB slate with 15 scheduled games, 0 active candidates, 0 official picks and 0 provider calls.

Completion criteria: Started/final MLB rows are excluded from active surfaces, next-slate preview is read-only, `prepare_next_slate` returns the exact bounded SportsDataIO endpoint plan without transport, and real provider execution remains blocked until explicit approval.

### 21. MLB Live Data Refresh V1

Objective: Execute approved SportsDataIO MLB preparation calls and refresh supported recommendation surfaces without weakening official-pick policy.

Status: Implemented for the bounded 2026-07-17 slate preparation and repaired by MLB Odds Coverage Reconciliation V1. Real execution is protected by auth, confirmation, budget checks, checkpoints and a local action lock.

Backend scope: `provider-budget.service.ts`, `mlb-market-capability-registry.service.ts`, `operating-day-automation.service.ts`, `/api/providers/budget/status`, `/api/mlb/markets/capabilities`, `/api/operating-day/automation/status`, `/api/cron/operating-day` and `/api/system/version`.

Frontend scope: Existing dashboard panels consume refreshed Current Board and Next Slate state.

Persistence or migration scope: No new migration. Existing operating-day and checkpoint tables are reused.

Validation: `npm.cmd run build` exits 0. The approved preparation and scoped repair linked 15 events, mapped 15/15 odds records, produced 45 prospective predictions, exposed 21 Current Board actionable candidates after price/freshness filtering and left official picks at 0.

Completion criteria: Approved real preparation can run end to end, core full-game markets refresh across Current Board/Most Likely/Best Value/Market Intelligence/AI Bet Finder/Top Picks/Bet Slip/Arbitrage, unsupported markets remain hidden or unavailable, and one consolidated Vercel cron entry drives scheduler-ready automation.

### 22. MLB Odds Coverage Reconciliation and Deployment Recovery V1

Objective: Repair the 2026-07-17 MLB odds/event mapping gap, document verified market coverage and deploy under Vercel Hobby cron limits.

Status: Implemented as a focused corrective patch. The event resolver now scopes the selected date to America/Puerto_Rico UTC boundaries (`04:00Z` to next-day `04:00Z`) and avoids reusing partial odds checkpoints as complete coverage. `/api/mlb/odds/coverage` provides a zero-provider-call diagnostic for schedule records, provider odds records, event mapping, normalized odds, feature snapshots, prediction counts, Current Board actionability and critical missing inputs.

Backend scope: SportsDataIO MLB prospective-preview date scoping, read-only odds coverage diagnostic route, automation status cron metadata and system version route counts.

Frontend scope: No new production betting surface. Existing dashboard surfaces consume the repaired stored state and remain governed by Current Board and official-pick policies.

Persistence or migration scope: None. Existing `sport_events`, `sports_odds_snapshots`, `prediction_history`, operating-day tables and sync checkpoints are reused.

Validation: `npm.cmd run build` exits 0. Zero-call diagnostics report 15 scheduled games, 15 provider odds records, 15 mapped games, 0 unmapped games, 45 predictions, 21 Current Board actionable candidates, 0 official picks and providerCallsMade 0.

Completion criteria: The root cause of 6/15 coverage is documented, all safely mappable games are recovered, unsupported markets remain unavailable rather than fabricated, missing pitcher/lineup/injury/weather/projection inputs are explicit, Vercel cron is daily-compatible and GitHub Actions provides an external scheduler-ready fallback.

### 23. Operating Day Cron Reliability and MLB Data Quality V1

Objective: Make real cron execution safe when the slate is already current and make MLB readiness scores honest when critical inputs are missing.

Status: Implemented as a reliability/data-quality correction. Real cron execution now returns compact `already_current` no-op status for the fresh 2026-07-17 slate, and Current Board/data-quality surfaces report insufficient critical data rather than null or inflated readiness.

Backend scope: `/api/cron/operating-day`, `operating-day-automation.service.ts`, `current-board.service.ts`, `mlb-data-quality.service.ts` and `/api/mlb/data-quality`.

Frontend scope: Existing intelligence surfaces receive corrected Current Board candidate fields. No new official-pick surface was added.

Persistence or migration scope: None. Existing operating-day lifecycle events and sync checkpoints remain the provider-call ledger source.

Validation: Dry-run and real local cron both make 0 provider calls. Real cron returns `already_current`, providerCallsMade 0 and writes 0. Data-quality validation returns featureQuality 35, dataSufficiency 30, criticalDataCompleteness 0 and `INSUFFICIENT` for the current slate.

Completion criteria: Production cron no longer returns a generic 500 for a fresh slate, automation status is not misleading, critical missing MLB inputs reduce readiness, and official picks remain 0 unless strict existing gates are honestly satisfied.

### 24. MLB Provider Capability Audit and AI Coach V1

Objective: Identify which SportsDataIO MLB endpoints can improve model quality under the current subscription and expose deterministic explanations for preview-only candidates.

Status: Implemented as a zero-provider-call audit and explanation layer.

Backend scope: `mlb-provider-capability-audit.service.ts`, `/api/mlb/provider-capabilities/audit`, `mlb-ai-coach.service.ts` and `/api/mlb/ai-coach`.

Frontend scope: No new production betting surface. The coach route is ready for dashboard or AI Bet Finder integration.

Persistence or migration scope: None.

Validation: Capability audit validation passes 5/5 with providerCallsMade 0. MLB Coach validation passes 4/4 with providerCallsMade 0. Current answers explain TEX and MIA positive-EV previews as preview-only because production, quarantine, calibration, confidence and critical-data gates remain blocked.

Completion criteria: Endpoint capability boundaries are explicit, no unavailable market is exposed as supported, coach explanations are grounded in Current Board/data-quality state and official recommendations remain 0.

### 25. Best Bets Today - Official And Informational Selection Engine V1

Objective: Rank the strongest supported current MLB betting options of the day while preserving the official/no-bet boundary.

Status: Implemented as a read-only Current Board scoring layer. If existing official gates produce qualified candidates, the surface returns `BEST BETS TODAY`; otherwise it returns `BEST BETS TODAY - NOT RECOMMENDED` with informational candidates and blockers.

Backend scope: `best-bets-today.service.ts`, `/api/best-bets-today`, Current Board response extension, Top Picks response extension and MLB AI Coach best-bet answers.

Frontend scope: Today dashboard Top Picks panel now includes a prominent Best Bets Today section ahead of legacy official-only Top Picks columns.

Persistence or migration scope: None. The module reads existing Current Board predictions, odds and V5 starter/weather/stadium context only.

Validation: `npm.cmd run build` exits 0. The API contract reports providerCallsMade 0, remoteMutationsMade 0, officialHistoryChanged false and predictionsRegenerated false.

Completion criteria: Official picks remain governed by existing thresholds and production gates, informational fallbacks are clearly labeled not recommended, negative EV and blockers remain visible, and no provider quota or settlement path is touched.

### 26. MLB Prediction Engine V6 Preflight, Feature Injection, And Safe Regeneration V1

Objective: Prove and prepare real starter/weather/stadium calculation injection for current MLB prospective predictions without provider calls or history rewrites.

Status: Implemented through deterministic V6 projection injection and a protected zero-provider preflight route. Write-mode regeneration is intentionally blocked by `prediction_history_unique_pick`, because inserting immutable side-by-side V6 rows would otherwise require overwriting prior event/market/team predictions.

Backend scope: `sportsdataio-mlb-prospective-preview.service.ts`, `/api/mlb/predictions/v6-regeneration`, Current Board probability-origin metadata and Most Likely/Best Bets filtering for fallback/unavailable probabilities.

Frontend scope: None in this phase.

Persistence or migration scope: None applied. A future schema migration is required before immutable V6 prediction rows can be written.

Validation: `npm.cmd run build` exits 0. Local dry-run reports 14 eligible events, 1 excluded event, 42 planned V6 predictions, deterministic validation true and providerCallsMade 0. Confirmed write mode returns `schema_blocked_prediction_history_unique_pick` without overwriting prior rows.

Completion criteria: V6 feature injection path is explicit, deterministic validation passes, write mode is safely guarded, and the next required action is schema support for immutable prediction versions.

### 27. Prediction Versioning Engine V1

Objective: Allow champion, challenger, shadow and rollback prediction rows to coexist without overwriting prior predictions.

Status: Implemented in code and migration. Remote application of `202607170002_prediction_versioning_engine_v1.sql` is required before V6 challenger rows can be persisted.

Backend scope: `prediction_history` versioning migration, `probePredictionVersioningSchemaCapabilities`, Current Board `is_current=true` filtering after migration, and V6 regeneration challenger metadata.

Frontend scope: None in this phase. Current Board behavior is preserved until the migration is applied, then current surfaces continue to read current rows only.

Persistence or migration scope: `202607170002_prediction_versioning_engine_v1.sql` adds versioning columns, lineage indexes and current-row uniqueness by `prediction_group_key`.

Validation: `npm.cmd run build` exits 0. Provider calls remain 0. V6 write mode remains blocked until the migration is applied remotely.

Completion criteria: Version-aware code compiles, migration is ready, legacy runtime remains safe before migration, and the next phase is remote migration application followed by V6 challenger regeneration.

### 28. MLB V6 Model Comparison Report V1

Objective: Compare champion V5/V5-context rows against V6 challenger calculations before promotion.

Status: Implemented as a zero-provider-call report embedded in `/api/mlb/predictions/v6-regeneration`.

Backend scope: V6 regeneration response now includes `modelComparison` with per-prediction champion/challenger values and deltas for probability, confidence, edge, EV, feature quality and data sufficiency.

Frontend scope: None in this phase.

Persistence or migration scope: No new persistence. Corrective migration `202607170003_prediction_versioning_drop_legacy_unique_pick.sql` is required before V6 challenger rows can be persisted.

Validation: `npm.cmd run build` exits 0. Production validation returned `modelComparison.mode=mlb_prediction_v6_model_comparison_v1`, compared 33 predictions, average probability delta `-1.39`, average confidence delta `-1.95`, providerCallsMade 0 and no official-history mutation.

Completion criteria: Comparison report is available even when persistence is blocked, and the platform can quantify V6 changes before any promotion decision.

### 29. Prediction Versioning Corrective Verification And MLB Model Platform Guardrails V1

Objective: Verify the remote legacy unique-pick corrective migration by safely persisting V6 challenger rows, then expose read-only model-operations surfaces without promotion or provider usage.

Status: Implemented. The remote blocker was verified cleared by persisted challenger rows and idempotency reuse. V6 remains challenger-only and default production surfaces remain champion/current.

Backend scope: `mlb-model-platform.service.ts`, `/api/mlb/predictions/comparison`, `/api/mlb/predictions/shadow-evaluation`, `/api/mlb/predictions/promotion-readiness`, `/api/mlb/predictions/rollback-plan`, `/api/mlb/players/metadata-cache`, `/api/mlb/stadiums/metadata-cache`, `/api/mlb/intelligence/pitcher-bullpen-foundation` and opt-in `modelRole` support on `/api/current-board`.

Frontend scope: None in this phase. Existing Current Board behavior is preserved unless an operator explicitly requests `modelRole=challenger` or `modelRole=shadow`.

Persistence or migration scope: Corrective migration `202607170003_prediction_versioning_drop_legacy_unique_pick.sql` was applied remotely by the operator and verified by behavior. No new migration was added in this checkpoint.

Validation: `npm.cmd run build` exits 0. V6 dry-run planned 15 challenger rows with 0 provider calls. Confirmed write inserted 15 challenger rows, reused 0 and wrote checkpoint `ffb2e6eb-cb80-421a-87a6-69b0b345c5e5`; same-key rerun inserted 0, reused 15 and wrote checkpoint `733ccb04-c751-4648-a06f-6685898d738c`. Comparison matched 15 champion/challenger pairs with average probability delta `-1.36` and average confidence delta `-1.93`.

Completion criteria: Legacy unique blocker is cleared, challenger persistence is idempotent, comparison/quality-gate/shadow/promotion/rollback surfaces are available, player/stadium/pitcher-bullpen foundations are zero-call, and no official history, settlement, recommendation thresholds or provider quota are touched.

### 30. Autonomous Daily Operations and Production User Experience V1

Objective: Turn existing Pick Analyzer modules into one daily self-operating prototype and redesign Today so a first-time user can understand the board in under 20 seconds.

Status: Implemented as a zero-provider-call orchestration and UX consolidation pass.

Backend scope: `autonomous-daily-operations.service.ts` and `/api/autonomous-daily-operations/status` compose Operating Day, Provider Budget, Current Board, Best Bets Today, Most Likely, Best Value, AI Coach, MLB data quality, pitcher/bullpen foundation, champion-vs-challenger comparison, shadow evaluation, calibration and promotion readiness into one canonical daily status.

Frontend scope: `ProductionTodayPanel` is now the first Today surface. It shows `Should I Bet Today?`, Official Pick, Best Bet Today, Most Likely, Best Value, Most Likely Moneyline, Most Likely Parlay, bankroll recommendation, compact game cards, Today's Timeline, System Health, Today's Learning and Promotion Readiness. Legacy detailed Today panels remain behind collapsed supporting detail.

Persistence or migration scope: No migration. Read-only status requests do not create rows. Real operating-day execution stages still persist through `operating_day_lifecycle_events` via the existing operating-day executor.

Validation: `npm.cmd run build` exits 0, generates 235 static pages and exposes 238 API routes. The new status route is read-only, reports `providerCallsMade=0`, `remoteMutationsMade=0`, `historyImmutable=true`, `officialHistoryChanged=false` and `modelPromotionPerformed=false`.

Completion criteria: The daily lifecycle has one canonical summary, the user-facing Today screen is simplified and duplicate information is collapsed, learning/promotion readiness are visible without automatic promotion, and provider quota/history remain untouched.

### 31. SportsDataIO Discovery Integration V1

Objective: Turn existing SportsDataIO MLB endpoint catalog, provider audit and stored import evidence into one official discovery contract without spending provider quota or activating unsupported markets.

Status: Implemented as a read-only provider capability layer.

Backend scope: `sportsdataio-mlb-discovery.service.ts` and `/api/providers/sportsdataio/discovery` classify Discovery Lab versus enterprise endpoints, endpoint runtime status, field quality, identity mapping, storage integration, projection reactivation blockers, provider quota posture and capability-matrix evidence.

Frontend scope: Advanced Details > Provider now includes a compact SportsDataIO Discovery Lab panel.

Persistence or migration scope: None. The module reads existing catalog code, `sports_sync_jobs` metadata and normalized tables only.

Validation: `npm.cmd run build` exits 0. The discovery contract reports `providerCallsMade=0`, `remoteMutationsMade=0`, no prediction mutation, no official-pick changes and no model promotion.

Completion criteria: Pick Analyzer can answer which SportsDataIO MLB endpoint should be trusted, blocked, retried or left catalog-only before spending quota; unsupported market and projection families remain blocked until full end-to-end support exists.

### 32. Live Provider Verification and Data Acquisition V1

Objective: Replace provider assumptions with controlled live runtime evidence across all connected providers while preserving all prediction, settlement and recommendation guardrails.

Status: Implemented as a protected live verification route. Dry-run is public/read-only; live mode requires `CRON_SECRET`.

Backend scope: `live-provider-verification.service.ts` and `/api/providers/live-verification` verify SportsDataIO, The Odds API, MLB Stats API and the existing BSN homepage connector. The service profiles fields, endpoint rows, usable/empty/identity fields, provider health, canonical ownership, acquisition scores, before/after entity mapping counts, before/after team-game-stat counts and before/after projection counts.

Persistence or migration scope: No migration. Live mode writes one sanitized `sports_sync_jobs` checkpoint. Durable data acquisition still uses existing provider importers.

Validation: Local `npm.cmd run build` exits 0. Live execution remains protected and budget capped.

Completion criteria: Runtime evidence can be gathered under strict provider budgets without exposing secrets, duplicating importers, changing model behavior or fabricating data.

### 33. Production Operations Completion and End-to-End Reliability V1

Objective: Make existing production operations truthful and executable without duplicating schedulers, provider adapters, feature builders, prediction engines or projection engines.

Status: Implemented as an operations reliability layer.

Backend scope: `/api/operations/health`, upgraded `/api/operations/adaptive-refresh`, `operations-health.service.ts` and Adaptive Refresh protected execution through the existing operating-day executor.

Frontend scope: Advanced Details > Data includes a compact Operations Control Center.

Persistence or migration scope: No migration. Existing `operating_day_lifecycle_events` and `sports_sync_jobs` remain the execution ledgers.

Validation: `npm.cmd run build` exits 0. Live execution requires `CRON_SECRET`, provider budget approval and an action lock.

Completion criteria: Adaptive Refresh no longer claims live execution when it only planned; due supported work can execute through the protected existing operating-day pipeline, and `/api/operations/health` reports real readiness, blockers and freshness.

### 34. MLB Historical Import Job Durability and Observability V1

Objective: Make MLB SportsDataIO historical import attempts durable, observable and safely resumable before any additional historical provider retry.

Status: Implemented locally. Production retry remains gated on applying the additive sync-job terminal-status migration and receiving explicit retry authorization.

Backend scope: `sportsdataio-mlb-historical-import-executor.service.ts`, `/api/historical-import/execute`, `/api/historical-import/jobs` via `historical-import-engine.service.ts`, and `/api/operations/validation`.

Persistence or migration scope: Additive migration `202607210001_sports_sync_jobs_terminal_statuses.sql` extends `sports_sync_jobs.status` with `canceled` and `timed_out`. No destructive migration and no historical payload overwrite.

Validation: `npm.cmd run build` exits 0. Durability fixture validation passes 11/11 with `providerCallsMade=0` and `remoteMutationsMade=0`. Jobs smoke is read-only and reports 0 running, 0 stuck and 0 reconciliation required.

Completion criteria: Every live MLB historical import branch creates a `sports_sync_jobs` running checkpoint before provider transport, records provider call accounting states, converges to a terminal logical state when control returns, and exposes stuck-job reconciliation evidence without automatic retry.

### 35. MLB Player Identity Resolution V1

Objective: Resolve SportsDataIO MLB provider player identities deterministically before any multi-date player-game-stat backfill.

Status: Implemented and reconciled for the controlled 2026-07-17 PlayerGameStatsByDate import.

Backend scope: `sportsdataio-mlb-historical-import-executor.service.ts` now pages all canonical MLB `sport_players`, loads exact SportsDataIO MLB `provider_entity_mappings` with `entity_type='player'`, and merges them into canonical player lookups only when the mapped `sport_players.id` exists. Conflicting provider IDs are not overwritten, missing canonical players are ignored, and no fuzzy name matching is used.

Persistence or migration scope: No migration. The existing 2026-07-17 stat rows were reconciled using stored data only by updating `sport_player_stats.player_id` and resolution metadata. Statistical values, event IDs, team IDs, predictions, recommendations, Current Board, settlement and dashboard logic were not changed.

Validation: The 2026-07-17 imported stat rows improved from 82/418 player_id coverage to 418/418. Reconciliation updated 336 rows, found 0 conflicts, 0 unknown provider IDs, 0 duplicate stat IDs and 0 unresolved player flags after completion. The 2026-07-16 first pilot date initially resolved 8/27 rows because the deployed lookup still read only the first canonical player page; the pilot stopped before dates 2 and 3, the lookup was corrected to page `sport_players`, and 19 rows were reconciled from stored exact mappings only. Idempotency verification would make 0 additional updates. The durability fixture validation includes exact mapping, numeric/string provider ID normalization, conflict preservation and missing-canonical-player checks.

Completion criteria: Exact player identity resolution is available to future MLB historical imports, the controlled single-date import is fully reconciled, unresolved classifications are empty for that date, and a 3-date pilot can be considered only under a separate explicit authorization.

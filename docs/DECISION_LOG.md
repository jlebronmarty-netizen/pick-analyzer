# Decision Log

## 2026-07-12 - Use Next.js App Router With Service-Layer Business Logic

Context: The repository has 100 API route files under `src/app/api` and domain logic concentrated in `src/services`.

Decision: Keep route handlers thin and place reusable business logic in services.

Consequences: New modules should add or extend services first, then expose them through API routes and dashboard panels.

Affected modules: all API routes, dashboard, sync, predictions, settlement, analytics.

## 2026-07-12 - Use Supabase As Primary Persistence

Context: The project uses `src/lib/supabase.ts` and `src/lib/supabase-admin.ts`, with migrations under `supabase/migrations`.

Decision: Store project data in Supabase tables and use the service-role client only in server-side services/routes.

Consequences: Migrations must be additive and grants must match route/service usage. Browser components must not receive service-role secrets.

Affected modules: NBA Data Sync V1, prediction history, settlement, analytics, model learning.

## 2026-07-12 - Normalize Multi-Sport Data Before Sport-Specific Prediction Work

Context: `src/types/multi-sport.ts` and `multi-sport-*.service.ts` define normalized sports, leagues, events, markets, odds and provider health.

Decision: New sports and providers should use the Multi-Sport Engine rather than introducing parallel abstractions.

Consequences: Sport-specific engines should consume normalized or synced data and add only sport-specific features.

Affected modules: Multi-Sport Engine, NBA, future NFL, NHL, soccer, tennis and UFC work.

## 2026-07-12 - NBA Data Sync Must Not Fabricate Unsupported Provider Data

Context: The current NBA provider path does not supply injuries, lineups, rosters or advanced NBA metrics in the implemented sync layer.

Decision: Unsupported NBA domains return warnings or empty typed results instead of synthetic production data.

Consequences: Future injury and lineup work requires provider integration or explicitly approved data sources.

Affected modules: NBA Data Sync V1, NBA Prediction Engine V1, future Injury Provider Integration, Expected Lineups.

## 2026-07-12 - Reuse Existing Pick Intelligence For NBA Predictions

Context: NBA Prediction Engine V1 uses existing Prediction Engine V4, Kelly, Smart Ranking, Adaptive Scoring, risk grade and model-learning services.

Decision: NBA prediction work should add NBA feature engineering and orchestration, not duplicate shared intelligence.

Consequences: Future NBA Prediction Engine V2 must improve features/calibration while preserving shared scoring services.

Affected modules: NBA Prediction Engine V1/V2, Prediction Engine V4/V5, Smart Ranking, Kelly, Adaptive Learning.

## 2026-07-12 - Validate Predictions Before Persistence And Settle From Stored Terms

Context: NBA Prediction Validation & Settlement V1 added lifecycle metadata, feature snapshots, model version, cutoff timestamps, odds timestamps, line values and settlement details to `prediction_history`.

Decision: NBA predictions must be validated before saving and settled using the exact stored market, selection, odds and line.

Consequences: Backtesting and calibration can rely on auditable prediction records. No incomplete or cancelled event should be incorrectly graded.

Affected modules: NBA Prediction Validation & Settlement V1, NBA Backtesting & Calibration V1, AI Coach, model calibration.

## 2026-07-12 - Protected Operational Mutations Use CRON_SECRET

Context: Sync, generate, settlement and recalculation routes commonly authorize with `CRON_SECRET`.

Decision: Continue this pattern for server-side operational POST routes.

Consequences: Dashboard components should remain read-only for privileged actions unless a safe server-side admin pattern is added.

Affected modules: cron routes, NBA sync, NBA prediction generation, NBA settlement, recalculation routes.

## 2026-07-12 - Compute NBA Backtests From Prediction History Without New Persistence

Context: NBA Backtesting & Calibration V1 needed performance measurement before NBA Prediction Engine V2, but `prediction_history` already contains settled result, stake, profit, model version, feature snapshot and timestamp metadata.

Decision: Implement NBA backtesting and calibration as computed services over `prediction_history` for V1, with no migration or stored backtest runs.

Consequences: The module can return typed empty and insufficient-data responses without polluting production data. Persisted backtest run history can be added later only if there is a clear operational need.

Affected modules: NBA Backtesting & Calibration V1, NBA Prediction Engine V2, NBA Model Health, dashboard.

## 2026-07-12 - Split NBA Data Reconciliation Into Read-Only Planning And Provider Execution

Context: NBA data quality work needs to identify event, result, odds, standings, stats and mapping gaps, but provider-backed reconciliation can consume quota and should not run without explicit approval.

Decision: Implement NBA Data Quality and Historical Reconciliation Phase A as a read-only Supabase audit and dry-run planner with no provider calls, no external downloads and no migration. Keep provider-backed execution for a separately approved Phase B.

Consequences: The dashboard and APIs can show quality findings, coverage, historical gaps, estimated provider calls and a safe execution order without mutating production data or consuming quota.

Affected modules: NBA Data Quality and Historical Reconciliation Phase A/B, NBA Data Sync V1, NBA Prediction Engine V1/V2, NBA Backtesting & Calibration V1.

## 2026-07-12 - Compare NBA Books From Stored Odds Snapshots First

Context: Multi-book comparison is useful for best-price selection, but live/provider odds paths can consume quota and should not be used during autonomous overnight work.

Decision: Implement NBA Multi-Book Comparison V1 over `sports_odds_snapshots` only. The module ranks latest stored prices by sportsbook, flags stale groups and returns typed empty responses when no stored odds exist.

Consequences: Best-price logic is available without provider calls or schema changes. Steam move detection, arbitrage and CLV upgrades should consume stored odds history and remain blocked until real snapshots exist.

Affected modules: NBA Multi-Book Comparison V1, Steam Move Detection, Closing Line Value AI V2, Arbitrage Finder, NBA Prediction Engine V2.

## 2026-07-12 - Require Stored Snapshot Evidence For NBA Steam Moves

Context: Steam move detection can be misleading if it is inferred from model confidence or a single odds row. The project currently has no persisted NBA odds snapshots in the validated state.

Decision: Implement NBA Steam Move Detection V1 as a temporal stored-snapshot scanner. A steam signal requires repeated snapshots, aligned movement across multiple books and explicit snapshot IDs as evidence.

Consequences: The module is safe to run with empty data and makes no provider calls. It will not fabricate steam signals until real repeated sportsbook snapshots are persisted.

Affected modules: NBA Steam Move Detection V1, NBA Multi-Book Comparison V1, Closing Line Value AI V2, Arbitrage Finder, NBA Prediction Engine V2.

## 2026-07-12 - Route Provider Work Through Dry-Run Capability Intelligence First

Context: Several roadmap modules need provider decisions, but external calls, paid quota and unavailable credentials are restricted during autonomous work.

Decision: Add Provider Intelligence V1 as a registry-driven capability and dry-run routing layer. It scores configured providers from existing metadata and environment-key presence, and exposes reusable capability assertions before execution paths are attempted.

Consequences: Future sync, injury, lineup, odds, historical reconciliation and prop modules can check capability state without calling providers. Unsupported operations can return typed warnings instead of attempting unavailable work.

Affected modules: Provider Intelligence V1, Multi-Sport Engine, NBA Data Sync V1, Injury Provider Integration, Expected Lineups, Prop Bets Engine, Historical Reconciliation Phase B.

## 2026-07-12 - Generalize Data Quality As Read-Only Cross-Sport Planning

Context: NBA Phase A proved that stored-data audits are useful even when provider execution is blocked. Other sports also need coverage, freshness and reconciliation visibility without consuming quota.

Decision: Add Global Data Quality Framework V1 over shared Supabase tables and pair it with a dry-run global reconciliation planner. The planner may estimate calls and provider support, but never executes provider work.

Consequences: Cross-sport data gaps, stale jobs, missing odds and prediction/event mismatches are visible from one dashboard. Provider-backed repair remains separately approved work.

Affected modules: Global Data Quality Framework V1, Provider Intelligence V1, NBA Data Quality Phase A/B, future sport-complete modules.

## 2026-07-12 - Harden API Contracts Gradually

Context: The API surface is broad and rewriting every route at once would create unnecessary regression risk.

Decision: Add reusable API contract helpers for request IDs, typed errors and safe parsing, then migrate representative new routes first. Future routes should adopt the helper when created or touched.

Consequences: New framework routes have consistent observability and failure envelopes while existing public contracts remain stable.

Affected modules: API Contract Hardening V1, Provider Intelligence V1, Global Data Quality Framework V1, future API routes.

## 2026-07-12 - Build Runtime Observability From Existing Operational Tables First

Context: The project needs visibility into sync jobs, predictions, provider state and recent failures, but adding request-event persistence would require a migration.

Decision: Implement Runtime Observability V1 as a read-only aggregation over `sports_sync_jobs`, `prediction_history` and Provider Intelligence V1. Defer persistent API-duration and warning-event storage to a future additive migration.

Consequences: Operational state is visible immediately with no schema changes and no provider calls. Deeper request-level observability remains a future enhancement.

Affected modules: Runtime Observability V1, Provider Intelligence V1, Global Data Quality Framework V1, future Sync Reliability Framework.

## 2026-07-12 - Add Sync Reliability Primitives Before Rewiring Provider Sync

Context: Provider-backed sync flows need retry, timeout, partial-success and idempotency guardrails, but mass rewiring existing sync services would risk regressions without live provider validation.

Decision: Implement Sync Reliability Framework V1 as reusable additive primitives with a deterministic self-test API and dashboard panel. Defer broad integration until specific sync modules are touched or Phase B is approved.

Consequences: Future provider-backed work has standard reliability tools ready, while current sync behavior remains stable.

Affected modules: Sync Reliability Framework V1, Runtime Observability V1, NBA Historical Reconciliation Phase B, future provider integrations.

## 2026-07-12 - Add Generic Prediction Safety Without Replacing NBA Validation

Context: NBA Prediction Validation V1 already enforces sport-specific persistence and duplicate rules. Future sports need reusable safety checks, but replacing NBA validation would risk behavior changes.

Decision: Implement Prediction Safety Framework V1 beside the NBA validator. It provides generic checks and typed skip reasons with deterministic self-tests, while NBA validation remains unchanged.

Consequences: Future sport validators can reuse safety primitives, and NBA can adopt shared checks incrementally only where behavior matches exactly.

Affected modules: Prediction Safety Framework V1, NBA Prediction Validation V1, future NFL/NHL/soccer/tennis/UFC prediction engines.

## 2026-07-12 - Add Settlement Primitives Without Replacing NBA Settlement

Context: NBA settlement contains sport-specific lifecycle and period-market behavior. Future sports need reusable grading primitives, but replacing NBA settlement would be risky without a dedicated regression pass.

Decision: Implement Settlement Core V2 as additive moneyline, spread, total, push, void and pending primitives with deterministic self-tests. Keep NBA Prediction Settlement V1 unchanged.

Consequences: Future settlement modules can use shared primitives, and NBA can adopt them incrementally where behavior matches exactly.

Affected modules: Settlement Core V2, NBA Prediction Settlement V1, future sport settlement modules.

## 2026-07-12 - Compute Model Metrics From Prediction History Before Persisting Runs

Context: Backtesting and model health need reusable metrics, but storing metric runs would require a migration and operational retention decisions.

Decision: Implement Model Metrics Framework V1 as computed metrics over `prediction_history`, including Brier score, ROI, units and common splits. Defer persisted metric snapshots until there is a clear reporting need.

Consequences: Model metrics are available immediately without schema changes. Future calibration and engine versions can reuse the framework.

Affected modules: Model Metrics Framework V1, NBA Backtesting & Calibration V1, Prediction Engine V5, AI Coach, Model Center.

## 2026-07-12 - Plan Historical Imports Before Executing Provider Backfills

Context: The project needs historical imports for future SportsDataIO or other premium providers, but live provider calls, paid quota and credentials are restricted. Sport engines must not depend on provider-specific payload fields.

Decision: Implement Historical Import Engine Core V1 as a provider-independent dry-run planner over normalized data concepts. It reuses Provider Intelligence V1 and Sync Reliability Framework V1 for route planning, retry policy, cursor contracts and idempotency. Provider-backed execution is deferred until adapter contracts, quota caps and explicit approval exist.

Consequences: Future historical imports can be planned with checkpoints, dedupe keys, provider entity mapping and quota estimates without calling external providers. Sport prediction engines remain insulated from provider payloads.

Affected modules: Historical Import Engine Core V1, Provider Adapter SDK, SportsDataIO Adapter Contract, NBA Data Quality Phase B, future sport engines.

## 2026-07-12 - Formalize Provider Contracts Before Adding Premium Adapters

Context: Future SportsDataIO or other premium integrations must not leak provider-specific payload fields into sport engines, feature stores or prediction services.

Decision: Add Provider Adapter SDK V1 as a provider-independent contract for capabilities, auth, pagination, rate-limit hints, retry hints, normalized return models and fixture validation. Keep SDK validation local and zero-call.

Consequences: Concrete providers can be added against one contract, and Historical Import Engine checkpoints can call adapters later without sport-engine rewrites. Unsupported provider capabilities must return typed empty responses and warnings.

Affected modules: Provider Adapter SDK V1, SportsDataIO Adapter Contract, Historical Import Engine Core V1, Feature Store Core, future provider-backed sync modules.

## 2026-07-12 - Keep SportsDataIO Contract-Only Until Explicit Activation

Context: SportsDataIO may become a premium historical and injury/lineup provider, but credentials, quota caps and live execution are not approved.

Decision: Implement SportsDataIO Adapter Contract V1 as contract-only. It documents placeholder environment variable names, endpoint contracts, coverage, normalization mappings and local fixture validation while leaving live calls disabled.

Consequences: Future SportsDataIO activation can wire into Provider Adapter SDK and Historical Import Engine without changing sport prediction engines. No SportsDataIO quota is consumed during architecture work.

Affected modules: SportsDataIO Adapter Contract V1, Provider Adapter SDK V1, Historical Import Engine Core V1, Feature Store Core, Injury Provider Integration, Expected Lineups.

## 2026-07-12 - Add SportsDataIO Execution Readiness Without Live Provider Calls

Context: SportsDataIO historical imports require execution routes, runtime adapter behavior, pilot planning, resume/cancel contracts and validation contracts, but live imports need credentials, quota approval and tightly capped windows.

Decision: Implement SportsDataIO Historical Import Execution Readiness V1 as server-only architecture with dry-run defaults, hard caps, deterministic local validation and explicit live-execution rejection. Keep prediction engines and feature stores insulated from raw SportsDataIO payloads.

Consequences: The project can review execution shape, dependency order, persistence targets and pilot parameters before consuming any provider quota. Future live pilot execution remains a separately approved module with real credentials and post-import data quality validation.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, Historical Import Engine Core V1, SportsDataIO Adapter Contract V1, Provider Adapter SDK V1, NBA Data Quality Phase B, future injury/lineup/historical import modules.

## 2026-07-12 - Stop First SportsDataIO NBA Pilot On GamesByDate Authorization

Context: The NBA SportsDataIO key authenticated successfully against the Teams feed. The first capped pilot was limited to Teams, GamesByDate and ScoresByDate for `2025-12-25`, with a maximum of four external calls.

Decision: Stop the pilot immediately when `GamesByDate/2025-DEC-25` returned HTTP `401`. Do not call ScoresByDate, do not retry, do not import partial provider payloads and do not generate predictions.

Consequences: SportsDataIO Teams access is confirmed, but NBA schedule/score feed entitlement remains blocked. Future pilots must confirm GamesByDate or an equivalent schedule/results endpoint before attempting persistence. Failed pilot job observability must use UUID `sports_sync_jobs.id` values while retaining deterministic plan IDs in metadata.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, NBA Data Quality Phase B, Historical Import Engine Core V1, SportsDataIO Adapter Contract V1.

## 2026-07-13 - Persist SportsDataIO NBA Pilot Trial Data With Production Isolation

Context: SportsDataIO NBA authentication and `GamesByDate/2025-DEC-25` access were confirmed after the first pilot stopped on authorization. The user approved a maximum of 3 external calls and a maximum of 100 records for a real provider import-path validation using trial/scrambled data.

Decision: Execute the pilot through `/api/historical-import/execute` with `dryRun=false`, `confirmed=true`, `batchSizeDays=1` and `concurrencyLimit=1`. Call `Teams` and `GamesByDate/2025-DEC-25`; skip `ScoresByDate` when `GamesByDate` already contains normalized final scores. Persist only normalized teams metadata, provider mappings, events, final scores and sync-job metadata. Mark pilot records and mappings as `source=sportsdataio`, `trial=true`, `scrambled=true` and `production_eligible=false`. Reuse existing NBA team rows to avoid duplicate team-name conflicts. Exclude trial events from NBA prediction generation and validation.

Consequences: The project now has a verified real-provider import path for a tiny SportsDataIO NBA trial window, but the data is not authentic historical performance data and cannot be used for ROI, accuracy validation, calibration, betting recommendations or model training. Provider-backed historical reconciliation Phase B still requires explicit quota/date-window approval.

Affected modules: SportsDataIO NBA Pilot Import V1, SportsDataIO Historical Import Execution Readiness V1, NBA Prediction Engine V1, NBA Prediction Validation V1, NBA Data Quality Phase A, Historical Import Engine Core V1.

## 2026-07-13 - Keep SportsDataIO NBA Pilot V2 Partial After Call Cap Is Spent

Context: The user approved a second capped SportsDataIO NBA pilot for `2025-12-26` with at most 5 external calls, including events/scores, standings, team season stats and team game stats. The dry run was valid with zero provider calls. The live run used 4 provider calls and persisted trial-isolated events, standings and team season stats before `sport_game_stats` rejected decimal value `183.6` for an integer column.

Decision: Do not make additional provider calls after the approved cap was spent. Fix the importer normalization so integer-only score columns only receive integer values, document V2 as partial, and require a fresh explicitly approved capped rerun before marking game-stat persistence complete.

Consequences: Endpoint access for the V2 domains is partially validated and persisted rows remain `trial=true`, `scrambled=true` and `production_eligible=false`. The project avoids fabricating completion or exceeding quota. Pilot V3 should rerun the same narrow date/domains after approval to verify game-stat persistence.

Affected modules: SportsDataIO NBA Pilot Import V2, SportsDataIO Historical Import Execution Readiness V1, NBA Data Quality Phase A, Historical Import Engine Core V1.

## 2026-07-13 - Complete SportsDataIO NBA Pilot V2 With Integer-Safe Game Stats

Context: The first V2 run validated endpoint access and partial persistence, but game-stat persistence failed because a decimal provider metric reached an integer score column. The user approved one fresh capped rerun of the exact same date and domains with a maximum of 4 external calls.

Decision: Rerun the V2 pilot through the existing guarded `/api/historical-import/execute` route with `dryRun=false`, `confirmed=true`, `maximumRequests=4`, `batchSize=1` and `concurrencyLimit=1`. Keep the domain scope limited to games/scores, standings, team season stats and team game stats. Preserve trial isolation and do not generate or persist predictions.

Consequences: SportsDataIO V2 now completes for the approved trial/scrambled scope. The latest sync job is `completed`, 18 game-stat rows persisted, integer-only score fields contain integers only, duplicate and orphan checks pass, and production prediction queries continue to exclude trial rows. Broader historical reconciliation still requires explicit quota/date-window approval.

Affected modules: SportsDataIO NBA Pilot Import V2, SportsDataIO Historical Import Execution Readiness V1, NBA Data Quality Phase A, NBA Feature Store Integration V1, Historical Import Engine Core V1.

## 2026-07-13 - Block NBA Injuries Pilot On Unconfirmed SportsDataIO Endpoint

Context: The next priority after SportsDataIO NBA Pilot V2 was NBA Injuries Pilot V1. The repository contract declares an injury domain, but does not contain a concrete authenticated endpoint path. The user allowed a capped injury pilot and required stopping immediately on unexpected provider responses.

Decision: Use one entitlement probe against the contract-derived NBA injury path `/v3/nba/scores/json/Injuries`. The provider returned HTTP 404. Do not retry alternative feed names or guess additional paths. Do not persist injury records.

Consequences: NBA Injuries Pilot V1 is blocked pending exact endpoint confirmation from authenticated SportsDataIO documentation or the provider API Explorer. The existing NBA injury sync route remains the safe behavior: tracked warning, skipped row and no fabricated injury data. Feature Store optional injury context remains unavailable with warnings until real injury data is approved and persisted.

Affected modules: SportsDataIO NBA Injuries Pilot V1, SportsDataIO Adapter Contract V1, NBA Data Sync V1, NBA Feature Store Integration V1.

## 2026-07-13 - Complete NBA Injuries Pilot With Confirmed Projections Endpoint

Context: The SportsDataIO NBA injury endpoint was later confirmed as `/v3/nba/projections/json/InjuredPlayers`, and the user approved a capped live pilot with at most 2 external calls and no production prediction, backtesting or training usage.

Decision: Add an injuries-only guarded pilot path in `sportsdataio-historical-import-readiness.service.ts` using the projections base URL. Normalize and persist trial-isolated injury rows into `sport_injuries`, map injury provider IDs through `provider_entity_mappings`, preserve unresolved players/teams with null foreign keys and warnings, and keep all imported rows `production_eligible=false`.

Consequences: NBA Injuries Pilot V1 is complete for the approved trial/scrambled scope. Six injury rows and six injury mappings persisted, two unresolved players and two unresolved teams were preserved as warnings, and production confidence leakage remains blocked. These records are not production betting inputs and must not be used for ROI, calibration, model training or recommendations.

Affected modules: SportsDataIO NBA Injuries Pilot V1, SportsDataIO Historical Import Execution Readiness V1, NBA Feature Store Integration V1, future lineup/confidence modules.

## 2026-07-12 - Define Feature Store Contracts Before Persisting Snapshots

Context: Prediction engines need versioned, cutoff-safe features, but durable feature snapshot persistence requires migration and retention decisions.

Decision: Implement Feature Store Core V1 as a computed contract over definitions and local fixtures. Include freshness, provenance, sample size, quality, sufficiency, cutoff timestamps, invalidation keys and deterministic leakage validation. Defer durable persistence.

Consequences: Future sport engines can consume Feature Store-compatible snapshots without provider payload access. A later additive migration can persist snapshots when operationally justified.

Affected modules: Feature Store Core V1, Multi-Sport Feature Registry, NBA Feature Store Integration, Prediction Engine V5, backtesting/calibration.

## 2026-07-12 - Register Sport Feature Sets Before Engine Integration

Context: Feature Store Core defines generic features, but sport engines need market-specific required and optional feature sets with fallback policies.

Decision: Implement Multi-Sport Feature Registry V1 as a declarative registry over Feature Store Core definitions. It marks ready, partial and unsupported feature sets explicitly and validates that required definitions exist.

Consequences: NBA can integrate with Feature Store contracts first, while other sports expose missing sport-specific domains without fabricating features.

Affected modules: Multi-Sport Feature Registry V1, NBA Feature Store Integration, future MLB/NFL/NHL/soccer/tennis/UFC engines.

## 2026-07-12 - Integrate NBA Features Without Rewriting Prediction Generation

Context: NBA Prediction Engine V1 already persists feature context in `prediction_history.feature_snapshot`, and changing generation behavior would be risky without live NBA candidate coverage.

Decision: Implement NBA Feature Store Integration V1 as a read-only compatibility layer. It previews Feature Store-compatible NBA snapshots, validates NBA feature-set readiness and reads existing prediction feature metadata when available, but does not alter NBA prediction generation.

Consequences: NBA is ready for a future Feature Store-backed V2 path while V1 contracts remain stable. Durable feature persistence remains deferred.

Affected modules: NBA Feature Store Integration V1, NBA Prediction Engine V1/V2, Feature Store Core V1, Multi-Sport Feature Registry V1.

## 2026-07-12 - Build Sport Engines On A Shared Prediction SDK First

Context: The project needs MLB, NFL, soccer, NHL, tennis and UFC engines, but each sport should not duplicate probability, edge, expected value, Kelly, Smart Ranking, Monte Carlo, persistence, settlement or model-health logic.

Decision: Add Shared Sport Prediction Engine SDK V1 before new sport engines. The SDK consumes normalized events, participants, odds and Feature Store snapshots, exposes market capabilities and deterministic prediction contracts, and labels outputs as architecture/deterministic complete while real-data validation and historical calibration remain pending.

Consequences: Future sport engines can add only sport-specific feature engineering and projection strategies. Engines must not read raw provider payloads, fabricate unavailable data or claim commercial accuracy without stored-data validation and calibration.

Affected modules: Shared Sport Prediction Engine SDK V1, MLB Prediction Engine V1, NFL Prediction Engine V1, Soccer Prediction Engine V1, NHL Prediction Engine V1, Tennis Prediction Engine V1, UFC Prediction Engine V1, Feature Store Core V1, Multi-Sport Feature Registry V1.

## 2026-07-12 - Keep MLB Feature Integration Partial Until Real Sport-Specific Inputs Exist

Context: MLB can reuse generic event, team-form and market-odds feature contracts, but reliable probable pitcher, lineup, weather, park-factor and advanced-stat inputs are not currently normalized through approved provider-independent sources.

Decision: Implement MLB Feature Store Integration V1 as a read-only compatibility layer over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts. Return explicit missing-domain warnings and a partial status instead of fabricating MLB-specific production data.

Consequences: MLB Prediction Engine V1 can proceed architecturally with deterministic fixtures and typed warnings, but real-data validation and historical calibration remain pending until the missing domains are sourced and normalized.

Affected modules: MLB Feature Store Integration V1, MLB Prediction Engine V1, Feature Store Core V1, Multi-Sport Feature Registry V1, Shared Sport Prediction Engine SDK V1.

## 2026-07-12 - Implement MLB Prediction Engine As Architecture-Only Until Calibration Exists

Context: MLB Prediction Engine V1 can exercise the Shared Sport Prediction Engine SDK, but the project does not yet have approved normalized probable pitcher, weather, park-factor, lineup or calibrated historical MLB feature data.

Decision: Build MLB Prediction Engine V1 as deterministic preview architecture over Feature Store snapshots and SDK contracts. Do not persist picks, call providers, use raw provider payloads or claim production recommendation quality.

Consequences: The shared sport-engine pattern is proven for MLB moneyline, spread/run line and total markets while real-data validation, duplicate prevention, persistence and historical calibration remain explicit future work.

Affected modules: MLB Prediction Engine V1, MLB Feature Store Integration V1, Shared Sport Prediction Engine SDK V1, Feature Store Core V1, future NFL/Soccer/NHL/Tennis/UFC engines.

## 2026-07-12 - Keep NFL Feature Integration Partial Until Impact Context Exists

Context: NFL can reuse generic event, team-form and market-odds feature contracts, but quarterback impact, injury impact, weather and rest/travel context are not yet normalized through approved provider-independent sources.

Decision: Implement NFL Feature Store Integration V1 as a read-only compatibility layer over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts. Return explicit missing-domain warnings and partial status instead of fabricating NFL-specific production data.

Consequences: NFL Prediction Engine V1 can proceed architecturally with deterministic fixtures and typed warnings, but real-data validation and historical calibration remain pending until the missing domains are sourced and normalized.

Affected modules: NFL Feature Store Integration V1, NFL Prediction Engine V1, Feature Store Core V1, Multi-Sport Feature Registry V1, Shared Sport Prediction Engine SDK V1.

## 2026-07-12 - Implement NFL Prediction Engine As Architecture-Only Until Calibration Exists

Context: NFL Prediction Engine V1 can exercise the Shared Sport Prediction Engine SDK, but the project does not yet have approved normalized quarterback, injury, weather, rest/travel or calibrated historical NFL feature data.

Decision: Build NFL Prediction Engine V1 as deterministic preview architecture over Feature Store snapshots and SDK contracts. Do not persist picks, call providers, use raw provider payloads or claim production recommendation quality.

Consequences: The shared sport-engine pattern is proven for NFL moneyline, spread, total and first-half markets while real-data validation, duplicate prevention, persistence and historical calibration remain explicit future work.

Affected modules: NFL Prediction Engine V1, NFL Feature Store Integration V1, Shared Sport Prediction Engine SDK V1, Feature Store Core V1, future Soccer/NHL/Tennis/UFC engines.

## 2026-07-12 - Keep Soccer Feature Integration Draw-Aware And Partial

Context: Soccer cannot be treated as a simple two-way market because draw probability, league strength, lineups and injuries materially affect prediction architecture, and these domains are not yet normalized through approved sources.

Decision: Implement Soccer Feature Store Integration V1 as a read-only compatibility layer over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts. Return explicit draw-aware and league-context warnings instead of fabricating production data.

Consequences: Soccer Prediction Engine V1 can proceed architecturally with deterministic fixtures and typed warnings, but real-data validation and historical calibration remain pending until draw-aware feature inputs and league-specific data are sourced and normalized.

Affected modules: Soccer Feature Store Integration V1, Soccer Prediction Engine V1, Feature Store Core V1, Multi-Sport Feature Registry V1, Shared Sport Prediction Engine SDK V1.

## 2026-07-12 - Model Soccer As Three-Way First

Context: Soccer markets include home/draw/away, double chance, draw no bet, first-half 1X2 and qualification contracts. Treating soccer as a generic two-way moneyline engine would hide draw risk and produce misleading recommendations.

Decision: Implement Soccer Prediction Engine V1 with a soccer-specific deterministic probability layer. Normalize home/draw/away probabilities together, remove three-way overround together, derive double chance and draw no bet from 1X2 probabilities, model BTTS separately from totals and keep qualification separate from match winner.

Consequences: Soccer can reuse Shared Sport Prediction Engine utilities for fair odds, EV, Kelly and Smart Ranking while preserving soccer-specific market semantics. The engine remains architecture-only until draw-aware, lineup, injury, expected-goals and league-strength inputs are normalized and historically calibrated.

Affected modules: Soccer Prediction Engine V1, Soccer Feature Store Integration V1, Shared Sport Prediction Engine SDK V1, Settlement Core V2, future Multi-Sport Settlement Extensions.

## 2026-07-12 - Keep NHL Feature Integration Goalie-Aware And Partial

Context: NHL can reuse generic event, team-form and market-odds feature contracts, but starting goalie, goalie form, injury impact, special-teams and rest/travel context are not yet normalized through approved provider-independent sources.

Decision: Implement NHL Feature Store Integration V1 as a read-only compatibility layer over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts. Return explicit goalie and sport-context warnings instead of fabricating production data.

Consequences: NHL Prediction Engine V1 can proceed architecturally with deterministic fixtures and typed warnings, but real-data validation and historical calibration remain pending until the missing domains are sourced and normalized.

Affected modules: NHL Feature Store Integration V1, NHL Prediction Engine V1, Feature Store Core V1, Multi-Sport Feature Registry V1, Shared Sport Prediction Engine SDK V1.

## 2026-07-12 - Implement NHL Prediction Engine As Architecture-Only Until Calibration Exists

Context: NHL Prediction Engine V1 can exercise the Shared Sport Prediction Engine SDK, but the project does not yet have approved normalized starting goalie, goalie form, injury, special-teams, rest/travel or calibrated historical NHL feature data.

Decision: Build NHL Prediction Engine V1 as deterministic preview architecture over Feature Store snapshots and SDK contracts. Do not persist picks, call providers, use raw provider payloads or claim production recommendation quality.

Consequences: The shared sport-engine pattern is proven for NHL moneyline, puck line/spread and total markets while real-data validation, duplicate prevention, persistence and historical calibration remain explicit future work.

Affected modules: NHL Prediction Engine V1, NHL Feature Store Integration V1, Shared Sport Prediction Engine SDK V1, Feature Store Core V1, future Tennis/UFC engines.

## 2026-07-12 - Keep Tennis Feature Integration Player-Aware And Partial

Context: Tennis can reuse generic event and market-odds feature contracts, but player form, surface, ranking and injury context are not yet normalized through approved provider-independent sources.

Decision: Implement Tennis Feature Store Integration V1 as a read-only compatibility layer over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts. Mark the tennis feature set partial and return explicit player/surface/ranking warnings instead of fabricating production data.

Consequences: Tennis Prediction Engine V1 can proceed architecturally with deterministic fixtures and typed warnings, but real-data validation and historical calibration remain pending until the missing domains are sourced and normalized.

Affected modules: Tennis Feature Store Integration V1, Tennis Prediction Engine V1, Feature Store Core V1, Multi-Sport Feature Registry V1, Shared Sport Prediction Engine SDK V1.

## 2026-07-12 - Implement Tennis Prediction Engine As Architecture-Only Until Calibration Exists

Context: Tennis Prediction Engine V1 can exercise the Shared Sport Prediction Engine SDK, but the project does not yet have approved normalized player form, surface, ranking, injury or calibrated historical tennis feature data.

Decision: Build Tennis Prediction Engine V1 as deterministic preview architecture over Feature Store snapshots and SDK contracts. Do not persist picks, call providers, use raw provider payloads or claim production recommendation quality.

Consequences: The shared sport-engine pattern is proven for tennis match-winner and match-total contracts while real-data validation, duplicate prevention, persistence and historical calibration remain explicit future work.

Affected modules: Tennis Prediction Engine V1, Tennis Feature Store Integration V1, Shared Sport Prediction Engine SDK V1, Feature Store Core V1, future UFC engine.

## 2026-07-12 - Keep UFC Feature Integration Fighter-Aware And Partial

Context: UFC can reuse generic event and market-odds feature contracts, but fighter form, camp, injury, method and weigh-in context are not yet normalized through approved provider-independent sources.

Decision: Implement UFC Feature Store Integration V1 as a read-only compatibility layer over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts. Mark the UFC feature set partial and return explicit fighter/camp/method warnings instead of fabricating production data.

Consequences: UFC Prediction Engine V1 can proceed architecturally with deterministic fixtures and typed warnings, but real-data validation and historical calibration remain pending until the missing domains are sourced and normalized.

Affected modules: UFC Feature Store Integration V1, UFC Prediction Engine V1, Feature Store Core V1, Multi-Sport Feature Registry V1, Shared Sport Prediction Engine SDK V1.

## 2026-07-12 - Keep UFC Method Markets Contract-Only In V1

Context: UFC Prediction Engine V1 can model a fight-winner preview through the shared moneyline contract, but method-of-victory markets require combat-specific grading rules and richer result metadata that are not yet normalized.

Decision: Build UFC Prediction Engine V1 with one settlement-compatible moneyline preview and one explicit method contract preview that is not settlement-compatible. Do not persist method contracts or claim they can be graded in V1.

Consequences: UFC architecture can represent combat-specific market intent without fabricating settlement capability. Future UFC completion work must add normalized fight result details and combat settlement rules before method markets become production candidates.

Affected modules: UFC Prediction Engine V1, UFC Feature Store Integration V1, Settlement Core V2, future UFC Complete.

## 2026-07-13 - Treat SportsDataIO NBA Players As Trial-Isolated Identity Data

Context: The SportsDataIO NBA `Players` feed is available to the configured server-only key and returns a capped roster payload, but the current subscription payload is trial/scrambled and cannot support production player intelligence, player props, calibration or model training.

Decision: Complete SportsDataIO NBA Players Pilot V1 by importing only player identity and provider mapping records into existing normalized tables. Mark every imported player and mapping with `source=sportsdataio`, `trial=true`, `scrambled=true`, `production_eligible=false` and `importModule=sportsdataio_nba_players_pilot_v1`. Keep injuries, lineups, props, player stats and production recommendations out of scope.

Consequences: The project now has validated roster/player mapping persistence for the trial SportsDataIO path, but production prediction, backtesting and calibration must continue excluding those records. Future player-dependent modules may use the mappings for import-path validation only until authentic production-eligible data is approved.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, SportsDataIO NBA Players Pilot V1, NBA Feature Store Integration V1, future injury/lineup/player-prop modules.

## 2026-07-13 - Chunk Large Supabase Preflight Reads Before Provider Import Upserts

Context: The first live players execution exposed a PostgREST preflight failure when hundreds of normalized player IDs were checked in one `.in()` query before upsert.

Decision: Harden the SportsDataIO historical import readiness service so existing-ID and provider-mapping preflight checks are chunked before upsert. This keeps the same conflict targets and tables while avoiding oversized query URLs.

Consequences: Larger capped pilot payloads can validate idempotency without a schema migration or destructive change. Future import modules should reuse chunked preflight reads when checking many provider IDs or normalized primary keys.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, SportsDataIO NBA Players Pilot V1, future provider-backed import pilots.

## 2026-07-13 - Treat Stored NBA Injury Data As Confidence Context, Not Automatic Confidence Lift

Context: SportsDataIO NBA Injuries Pilot V1 persisted trial/scrambled injury rows with unresolved player and team mappings. The project needed the NBA Feature Store, Prediction Engine, Prediction Safety Framework, explanations, Model Health and dashboards to understand injury availability without making provider calls or implying trial data is production-ready.

Decision: Add a provider-independent NBA injury/lineup confidence service over stored `sport_injuries` rows and static provider configuration state. Feed its normalized availability, freshness, trial flags, unresolved counts and confidence penalties into NBA Feature Store previews, NBA Prediction Engine feature quality and data sufficiency, Prediction Safety warnings, Model Health V2 and dashboard observability. Keep expected lineups explicitly unavailable until an exact endpoint and entitlement are confirmed.

Consequences: Trial/scrambled injuries can validate architecture but cannot improve production confidence. Missing injury data is not treated as a healthy roster, stale feeds reduce confidence, unresolved high-impact rows create warnings and missing lineups remain a penalty. No provider calls, migrations, production pick persistence, backtesting or model training are introduced by this module.

Affected modules: NBA Injury and Lineup Confidence Integration V1, NBA Feature Store Integration V1, NBA Prediction Engine V1, Prediction Safety Framework V1, NBA Model Health V2, SportsDataIO NBA Injuries Pilot V1, Expected Lineups.

## 2026-07-13 - Use Dedicated Sport Lineups Persistence For Depth Charts And Starting Lineups

Context: SportsDataIO depth charts and starting lineups are event/team/player relationship records. Existing `sport_players`, `sport_events`, `sports_teams` and `provider_entity_mappings` tables can store identities and mappings, but they cannot safely represent lineup type, event context, starter flags, depth order, confirmation level and trial eligibility without overloading unrelated metadata.

Decision: Add a non-destructive `sport_lineups` migration for normalized depth-chart and starting-lineup rows. Keep the SportsDataIO pilot guarded, capped and trial-isolated. Do not apply the migration automatically, and do not let trial lineup/depth rows improve production confidence.

Consequences: The import path can validate endpoint contracts and mappings, but complete lineup/depth persistence requires manual migration application. NBA confidence integration can consume `sport_lineups` when present and otherwise returns explicit unavailable warnings instead of fabricating healthy or confirmed roster context.

Affected modules: SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1, NBA Injury and Lineup Confidence Integration V1, NBA Feature Store Integration V1, Historical Import Execution Readiness V1, future Expected Lineups.

## 2026-07-13 - Stop Depth/Lineups Pilot On Provider Transport Failure

Context: The first live execution attempt for SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 authorized locally but failed before provider HTTP status. A direct sanitized depth-chart probe also failed before status with transport cause `ENOBUFS`.

Decision: Stop the pilot without further provider probing. Record the pilot as blocked rather than completed, preserve the no-secret-exposure rule, and leave the next run dependent on healthy local provider transport plus manual application of the additive `sport_lineups` migration.

Consequences: No depth-chart or starting-lineup records were fetched, normalized or persisted. The code path, validation logic and docs exist, but live provider validation and persistence remain pending.

Affected modules: SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1, SportsDataIO Historical Import Execution Readiness V1, NBA Injury and Lineup Confidence Integration V1.

## 2026-07-13 - Validate Depth/Lineups Endpoints But Preserve Empty Persistence On Unknown Payload Shape

Context: After the `sport_lineups` migration was applied remotely and local network transport was restarted, the capped SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 was rerun with `maximumRequests=2`, `concurrencyLimit=1`, no automatic retries and a server-side request timeout. The elevated live run reached `/v3/nba/scores/json/DepthCharts` and `/v3/nba/projections/json/StartingLineupsByDate/2025-DEC-26` sequentially, and both returned HTTP 200.

Decision: Keep the import trial-isolated and do not fabricate lineup/depth rows when the trial/scrambled SportsDataIO payload does not match the current normalizer keys. Record the sync job with fetched/skipped counters, leave `sport_lineups` empty, keep production confidence blocked and require a future approved payload-shape review before another live persistence attempt.

Consequences: Endpoint access is confirmed and the `sport_lineups` upsert path is wired to the applied migration, but no lineup/depth records were inserted or updated. NBA feature preview, prediction health and prediction generation continue to report lineup context unavailable; trial injury rows still cannot improve production confidence. Future work should update normalizer key extraction before consuming additional provider quota for this domain.

Affected modules: SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1, SportsDataIO Historical Import Execution Readiness V1, NBA Injury and Lineup Confidence Integration V1, NBA Feature Store Integration V1.

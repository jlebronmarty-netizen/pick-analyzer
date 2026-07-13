# Project Status

Last updated: 2026-07-13 16:48:00 -04:00

## Current Architecture

Pick Analyzer is a Next.js 16 App Router application using React 19, TypeScript, Tailwind CSS and Supabase. The codebase is organized around:

- `src/app`: pages and 182 API route files.
- `src/components/dashboard`: dashboard panels and command-center UI.
- `src/services`: domain services for sports, predictions, sync jobs, settlement, analytics, portfolio, model learning, AI coach and provider adapters.
- `src/config/sports.config.ts`: sport registry and production-readiness flags.
- `src/types/multi-sport.ts`: normalized sport, league, event, market, odds, injury, lineup, player and prediction types.
- `src/lib/supabase.ts` and `src/lib/supabase-admin.ts`: Supabase browser/public and service-role clients.
- `supabase/migrations`: additive migrations for NBA data sync and NBA prediction validation/settlement metadata.

## Completed Modules Confirmed From Repository

- Core Next.js dashboard shell and API route structure.
- MLB-oriented legacy prediction stack using `prediction_history`, team stats, results, analytics and settlement services.
- Prediction Engine V4 utility/service surface.
- Smart ranking, Kelly staking, risk grading, adaptive scoring and model-learning services.
- Monte Carlo simulator service and API route.
- Portfolio AI V2 service/API/panel surface.
- AI Coach, AI Sports Brain, AI Copilot and daily report service/API/panel surfaces.
- Multi-Sport Engine foundation: registry, provider metadata, adapters, normalizers, markets, query facade and health route.
- NBA Adapter readiness panel/service.
- NBA Data Sync V1: teams, games, results, standings, stats, players, injuries, lineups and odds contract with provider warnings for unsupported data.
- NBA Prediction Engine V1: moneyline, spread, total and first-half prediction orchestration using existing Pick Analyzer intelligence.
- NBA Prediction Validation & Settlement V1: validation, lifecycle metadata, settlement, performance, backlog and Model Health V2 APIs.
- NBA Backtesting & Calibration V1: computed backtest, calibration buckets, leakage checks, API routes and dashboard panel over `prediction_history`.
- NBA Data Quality and Historical Reconciliation Phase A: read-only Supabase data quality audit, coverage summaries, dry-run reconciliation planner, API routes and dashboard panel.
- NBA Multi-Book Comparison V1: stored-odds-only sportsbook comparison, best-price ranking, stale market warnings, typed empty behavior, API route and dashboard panel.
- NBA Steam Move Detection V1: stored-odds-only temporal movement scanner, conservative steam thresholds, typed empty/insufficient-history behavior, API route and dashboard panel.
- Provider Intelligence V1: generic provider capability registry, dry-run routing, provider scoring, capability APIs and dashboard observability with zero provider calls.
- Global Data Quality Framework V1: cross-sport read-only quality audit, severity scoring, coverage summaries, dry-run reconciliation planning, API routes and dashboard observability.
- API Contract Hardening V1: reusable API response/request helpers with request IDs, typed errors, safe parsing and representative route adoption.
- Runtime Observability V1: read-only operational aggregation for sync jobs, prediction lifecycle, provider availability, warnings, errors and dashboard observability.
- Sync Reliability Framework V1: reusable bounded concurrency, retry, timeout, 429 handling, circuit breaker, partial-success, cursor and idempotency primitives with deterministic self-test.
- Prediction Safety Framework V1: reusable event timing, stale odds, market compatibility, feature completeness, duplicate, lifecycle and leakage-risk validation primitives.
- Settlement Core V2: reusable moneyline, spread, total, push, void and pending settlement primitives with deterministic self-test.
- Model Metrics Framework V1: reusable Brier score, ROI, units, sample warning and sport/market/confidence/data-sufficiency/model-version split metrics over stored predictions.
- Historical Import Engine Core V1: provider-independent dry-run historical import planning, checkpoint contracts, quota estimates, import health APIs and dashboard panel with zero provider calls.
- Provider Adapter SDK V1: provider-independent adapter contract, capability declarations, auth contract, pagination/rate-limit/retry shapes, fixture validation APIs and dashboard panel with zero provider calls.
- SportsDataIO Adapter Contract V1: contract-only SportsDataIO mapping into Provider Adapter SDK, fixture validation, activation guardrails and dashboard panel with zero provider calls and no credential requirement.
- SportsDataIO Historical Import Execution Readiness V1: server-only runtime adapter, capped dry-run execution planner, pilot plan, resume/cancel/validation contracts, capability/status APIs and dashboard integration with zero provider calls and no live execution.
- SportsDataIO NBA Pilot Import V1: capped live trial import for `2025-DEC-25` using SportsDataIO `Teams` and `GamesByDate`, persisted trial/scrambled teams metadata, provider mappings, events, scores and sync-job observability while excluding trial events from production predictions and validation.
- SportsDataIO NBA Pilot Import V2: completed capped live trial verification for `2025-DEC-26`; validated GamesByDate, standings, team season stats and team game stats endpoint access within 4 external calls, persisted trial-isolated game stats after the integer-normalization fix, preserved existing rows idempotently and kept trial records excluded from production predictions.
- SportsDataIO NBA Injuries Pilot V1: completed capped live trial import through `/v3/nba/projections/json/InjuredPlayers`; persisted 6 trial-isolated injury rows and 6 injury provider mappings, preserved 2 unresolved players and 2 unresolved teams as warnings, and kept production confidence leakage blocked.
- SportsDataIO NBA Players Pilot V1: completed capped live trial roster import through `Players`, persisted 579 trial-isolated `sport_players` rows and 579 player provider mappings, validated stable upsert keys, team relationships, mapping uniqueness and production exclusion.
- SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1: completed capped live endpoint validation through `/v3/nba/scores/json/DepthCharts` and `/v3/nba/projections/json/StartingLineupsByDate/2025-DEC-26` with 2 provider calls and HTTP 200 responses; the provider returned 39 trial/scrambled records, but the current normalizers produced 0 persistable lineup/depth rows, so no `sport_lineups` rows or lineup/depth mappings were inserted.
- Feature Store Core V1: provider-independent feature definitions, computed pre-event snapshots, freshness/provenance/sample-size/no-leakage validation APIs and dashboard panel with zero provider calls and no migration.
- Multi-Sport Feature Registry V1: sport/market/model feature-set registry, lookup/validation APIs and dashboard panel over Feature Store Core definitions with zero provider calls.
- NBA Feature Store Integration V1: read-only NBA feature snapshot compatibility layer, preview/validation APIs and dashboard panel over Feature Store Core without changing NBA prediction generation.
- NBA Injury and Lineup Confidence Integration V1: provider-independent confidence, sufficiency, safety, explanation, model-health and dashboard integration over stored NBA injury rows and explicit lineup-unavailable state with zero provider calls.
- Shared Sport Prediction Engine SDK V1: provider-independent sport engine contract, deterministic prediction builder, market capability declarations, explanation/warning contracts, Kelly and Smart Ranking integration contracts, validation APIs and dashboard panel with zero provider calls.
- MLB Feature Store Integration V1: provider-independent MLB feature snapshot compatibility layer, preview/validation APIs and dashboard panel over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts without changing legacy MLB prediction generation.
- MLB Prediction Engine V1: provider-independent deterministic MLB prediction architecture for moneyline, spread/run line and total using Shared Sport Prediction Engine SDK contracts with zero provider calls, no persistence and no production accuracy claim.
- NFL Feature Store Integration V1: provider-independent NFL feature snapshot compatibility layer, preview/validation APIs and dashboard panel over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts.
- NFL Prediction Engine V1: provider-independent deterministic NFL prediction architecture for moneyline, spread, total and first-half using Shared Sport Prediction Engine SDK contracts with zero provider calls, no persistence and no production accuracy claim.
- Soccer Feature Store Integration V1: provider-independent soccer feature snapshot compatibility layer, preview/validation APIs and dashboard panel over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts.
- Soccer Prediction Engine V1: provider-independent deterministic soccer prediction architecture for 1X2, double chance, draw no bet, totals, BTTS, first-half, qualification and Asian handicap contracts with zero provider calls, no persistence and no production accuracy claim.
- NHL Feature Store Integration V1: provider-independent NHL feature snapshot compatibility layer, preview/validation APIs and dashboard panel over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts.
- NHL Prediction Engine V1: provider-independent deterministic NHL prediction architecture for moneyline, puck line/spread and total using Shared Sport Prediction Engine SDK contracts with zero provider calls, no persistence and no production accuracy claim.
- Tennis Feature Store Integration V1: provider-independent tennis feature snapshot compatibility layer, preview/validation APIs and dashboard panel over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts.
- Tennis Prediction Engine V1: provider-independent deterministic tennis prediction architecture for match winner and match total using Shared Sport Prediction Engine SDK contracts with zero provider calls, no persistence and no production accuracy claim.
- UFC Feature Store Integration V1: provider-independent UFC feature snapshot compatibility layer, preview/validation APIs and dashboard panel over Feature Store Core, Multi-Sport Feature Registry and Shared Sport Prediction Engine SDK contracts.
- UFC Prediction Engine V1: provider-independent deterministic UFC prediction architecture for fight winner and contract-only method markets using Shared Sport Prediction Engine SDK contracts with zero provider calls, no persistence and no production accuracy claim.

## Active Module

SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 has live endpoint validation complete, but lineup/depth persistence is blocked by provider payload shape normalization. The approved endpoints returned HTTP 200, but no rows matched the current SportsDataIO depth/lineup normalizer keys.

## Pending Migrations

- `supabase/migrations/202607110001_nba_data_sync_v1.sql`: applied remotely per user.
- `supabase/migrations/202607110002_nba_data_sync_v1_grants.sql`: created for NBA sync table grants; remote state should be considered applied if SQL Editor was used.
- `supabase/migrations/202607110003_nba_prediction_validation_settlement_v1.sql`: applied remotely per user.
- `supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql`: applied remotely per user and verified through Supabase REST. Required for normalized depth-chart and starting-lineup relationship rows.

Future migrations should remain additive unless explicitly approved.

## Unresolved Blockers

- Supabase CLI is not installed or linked in this workspace, so remote migrations have been applied manually through Supabase SQL Editor.
- NBA provider data is currently sparse for the safe incremental window: teams/standings/stats can populate, but events and odds snapshots may be zero.
- Real NBA prediction persistence and settlement with actual candidates could not be fully exercised while no NBA events/odds are available.
- NBA Data Quality and Historical Reconciliation Phase B requires explicit approval because it will call external providers and may consume provider quota.
- Closing Line Value AI V2, Arbitrage Finder and NBA Prediction Engine V2 are blocked until stored odds/event coverage improves and provider-backed injury/lineup context is approved or explicitly deferred.
- Steam Move Detection V1 is implemented, but real signal output is blocked by zero stored NBA odds snapshots.
- Provider Intelligence V1 reports capability state from static registry and environment configuration only; live provider probes and persisted reliability history are future enhancements.
- Global Data Quality Framework V1 currently reports stored-state issues across shared tables; provider-backed fixes remain blocked by quota approval.
- API Contract Hardening V1 is representative adoption only; legacy routes should migrate gradually when touched.
- Runtime Observability V1 uses existing storage only; persisted API-duration and warning-event history would require a future additive migration.
- Sync Reliability Framework V1 is additive and not yet broadly wired into existing sync services; adoption should happen incrementally when provider-backed modules are touched.
- Prediction Safety Framework V1 is additive; NBA Prediction Validation V1 remains unchanged and compatible.
- Settlement Core V2 is additive; NBA Prediction Settlement V1 remains unchanged and compatible.
- Model Metrics Framework V1 uses stored `prediction_history`; persisted metric snapshots remain a future optional enhancement.
- Historical Import Engine Core V1 is dry-run only. Provider-backed historical execution remains blocked until explicit provider, quota and execution approval is given.
- Provider Adapter SDK V1 validates local fixtures only. Concrete provider adapters still need provider-specific contracts and explicit execution approval before live calls.
- SportsDataIO live NBA authentication and `GamesByDate/2025-DEC-25` access are confirmed for the configured server-only key.
- SportsDataIO NBA Pilot Import V1 used trial/scrambled payloads only. These rows are not authentic historical performance data and must not feed ROI, accuracy validation, calibration, betting recommendations or model training.
- SportsDataIO NBA Pilot Import V2 used trial/scrambled payloads only. It completed the approved import-path verification, but must not be treated as authentic historical reconciliation. Trial rows remain `production_eligible=false`.
- SportsDataIO NBA Injuries Pilot V1 uses the confirmed projections endpoint `/v3/nba/projections/json/InjuredPlayers`. Trial injury rows are not production-eligible and must not feed real ROI, calibration, model training or production betting recommendations.
- SportsDataIO NBA Players Pilot V1 used trial/scrambled roster payloads only. It persisted player identity/mapping records for import-path validation, not production player intelligence, player props, calibration, model training or betting recommendations.
- SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 has a guarded execution branch and verified `sport_lineups` migration. Live endpoint validation succeeded with HTTP 200 for both approved endpoints, but 30 depth-chart records and 9 starting-lineup records normalized to 0 persistable rows under the current key mapping. No lineup/depth rows were persisted, and provider payload-shape follow-up is required before persistence can populate safely.
- Provider-backed NBA Data Quality and Historical Reconciliation Phase B remains blocked until explicit quota/date-window approval. Do not run the estimated 821 provider calls from the dry-run plan.
- Feature Store Core V1 is computed/contract-only. Durable feature snapshot persistence remains deferred until an additive migration is explicitly approved.
- Multi-Sport Feature Registry V1 is declarative. Sport-specific missing domains such as MLB pitchers, NFL quarterback impact, NHL goalies, tennis player form and UFC fighter form remain future feature extensions.
- NBA Feature Store Integration V1 does not alter NBA prediction generation; durable generic feature persistence remains deferred.
- NBA Injury and Lineup Confidence Integration V1 reads stored `sport_injuries` rows only. Trial/scrambled injury rows validate architecture but lower or warn confidence instead of improving production confidence. Missing expected lineups are explicit warnings and are not treated as healthy or confirmed roster context.
- Shared Sport Prediction Engine SDK V1 is architecture-complete and deterministic-validation-complete only. Real-data validation and historical calibration remain pending for each sport engine.
- MLB Feature Store Integration V1 is partial by design because probable pitcher, confirmed lineup, weather, park-factor and advanced-stat domains are explicit warnings until approved normalized sources exist.
- MLB Prediction Engine V1 is deterministic-fixture-only. It does not persist predictions, consume provider data or create production betting recommendations until real MLB data validation and historical calibration are complete.
- NFL Feature Store Integration V1 is partial by design because quarterback impact, injury impact, weather and rest/travel domains are explicit warnings until approved normalized sources exist.
- NFL Prediction Engine V1 is deterministic-fixture-only. It does not persist predictions, consume provider data or create production betting recommendations until real NFL data validation and historical calibration are complete.
- Soccer Feature Store Integration V1 is partial by design because draw-aware context, league strength, confirmed lineups and injury context are explicit warnings until approved normalized sources exist.
- Soccer Prediction Engine V1 is deterministic-fixture-only. It does not persist predictions, consume provider data or create production betting recommendations until real soccer data validation and historical calibration are complete.
- NHL Feature Store Integration V1 is partial by design because starting goalie, goalie form, injury impact, special teams and rest/travel context are explicit warnings until approved normalized sources exist.
- NHL Prediction Engine V1 is deterministic-fixture-only. It does not persist predictions, consume provider data or create production betting recommendations until real NHL data validation and historical calibration are complete.
- Tennis Feature Store Integration V1 is partial by design because player form, surface, ranking and injury context are explicit warnings until approved normalized sources exist.
- Tennis Prediction Engine V1 is deterministic-fixture-only. It does not persist predictions, consume provider data or create production betting recommendations until real tennis data validation and historical calibration are complete.
- UFC Feature Store Integration V1 is partial by design because fighter form, camp, injury, method and weigh-in context are explicit warnings until approved normalized sources exist.
- UFC Prediction Engine V1 is deterministic-fixture-only. It does not persist predictions, consume provider data or create production betting recommendations until real UFC data validation and historical calibration are complete. Method contracts are explicitly not settlement-compatible in V1.

## Known Provider Limitations

- The Odds API is the primary NBA and multi-sport provider.
- SportsDataIO now supplies validated trial/scrambled NBA `Players` and `InjuredPlayers` paths for roster identity, injury records and provider mappings. These rows are not production-eligible and do not unlock expected lineups, player props, advanced NBA metrics, real calibration or betting recommendations.
- The Odds API scores endpoint has a limited recent historical window; full historical backfill cannot be assumed.
- Phase A quality planning found active-season event, result and odds gaps in stored Supabase data; these are planning outputs only and no provider refresh was executed.
- NBA Multi-Book Comparison V1 is ready to compare stored snapshots, but currently returns a valid empty response because no NBA odds snapshots are persisted.
- NBA Steam Move Detection V1 is ready to scan repeated stored snapshots, but currently returns a valid empty response because no NBA odds snapshots are persisted.
- Provider Intelligence V1 can mark injuries, lineups, player props, historical odds and live data as partial/unsupported when the project lacks approved production ingestion contracts.
- Global reconciliation planning is dry-run only and estimated 16 provider calls during validation; no calls were executed.
- Hardened representative routes now include request IDs and typed error envelopes.
- Runtime Observability V1 reported 5 sync jobs, 862 predictions, 346 pending predictions and zero provider calls during validation.
- Sync Reliability Framework V1 deterministic validation exposed 10 primitives, one isolated record failure and zero provider calls.
- Prediction Safety Framework V1 deterministic validation exposed 9 checks, 1 valid sample, 3 typed skips and zero provider calls.
- Settlement Core V2 deterministic validation checked 6 settlement scenarios with win, push, void and pending outcomes and zero provider calls.
- Model Metrics Framework V1 validation read 892 prediction rows, 516 settled rows, Brier score 0.2651 and zero provider calls.
- Historical Import Engine Core V1 plans provider-independent checkpoints, estimates calls and reports stored sync-job health without external provider calls.
- Provider Adapter SDK V1 exposes 9 endpoint contracts, validates 2 local fixtures, produced 0 validation errors and made zero provider calls.
- SportsDataIO Adapter Contract V1 exposes 9 endpoint contracts, validates 2 local fixtures, reports NBA as contract-ready, leaves live calls disabled and made zero provider calls.
- SportsDataIO Historical Import Execution Readiness V1 exposes 14 import domain contracts, 8 execution/readiness APIs, a capped pilot plan and deterministic runtime validation.
- SportsDataIO NBA Pilot Import V1 called `Teams` and `GamesByDate/2025-DEC-25`, used 2 external calls, fetched 35 records, normalized 35 records, updated 30 teams, inserted 35 SportsDataIO provider mappings, inserted 5 trial events, recorded 4 completed scores, inserted a completed `sports_sync_jobs` row, persisted no odds/injuries/lineups/player stats/play-by-play and exposed no secrets.
- SportsDataIO NBA Pilot Import V2 verification rerun for `2025-DEC-26` used 4 external calls, fetched 87 records, normalized 87 records, inserted 18 game-stat rows, updated 9 events, 30 standings rows, 30 team-stat rows and 9 mappings, skipped 0 records, recorded 0 errors and completed the latest `sports_sync_jobs` row. Game-stat coverage improved to 69.23%; no duplicate events, standings, team stats, game stats or provider mappings were found; no orphan game stats were found; integer score fields contained integers only; no secret was exposed.
- SportsDataIO NBA Injuries Pilot V1 successful execution used 1 external call to `InjuredPlayers`, fetched 6 records, normalized 6 records, inserted 6 `sport_injuries` rows and 6 injury provider mappings, skipped 0 records, preserved 2 unresolved players and 2 unresolved teams as warnings, recorded 0 errors and completed a `sports_sync_jobs` row. The previous `/v3/nba/scores/json/Injuries` probe remains historical evidence only.
- SportsDataIO NBA Players Pilot V1 successful execution used 1 external call to `Players`, fetched 579 records, normalized 579 records, inserted 579 `sport_players` rows and 579 player provider mappings, skipped 0 records, recorded 0 errors and completed a `sports_sync_jobs` row. The same autonomous session also used one prior `Players` entitlement/shape probe and two failed execution attempts before Supabase preflight reads were chunked; no secret was exposed.
- SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 used 2 external calls: `DepthCharts` returned HTTP 200 with 30 records and `StartingLineupsByDate/2025-DEC-26` returned HTTP 200 with 9 records. The current normalizers produced 0 rows, skipped 39, inserted 0, updated 0, persisted a completed sync job and exposed no secrets. Trial isolation and production confidence leakage checks remained blocked from improving confidence because no production-eligible rows exist.
- Feature Store Core V1 exposes 5 feature definitions, validates 2 local snapshots, catches intentional leakage risk and made zero provider calls.
- Multi-Sport Feature Registry V1 exposes 9 feature sets across 7 sports, validates no missing required definitions, marks 0 feature sets unsupported and made zero provider calls.
- NBA Feature Store Integration V1 now enriches optional NBA injury and lineup context with stored-row availability, unresolved mapping counts, trial isolation flags, freshness and confidence penalties. It remains no-migration and zero-provider-call.
- NBA Injury and Lineup Confidence Integration V1 validated through build/static route compilation with zero provider calls. Local HTTP endpoint validation was attempted but sandboxed HTTP could not connect to the local Next server and escalation was rejected by the approval layer.
- Shared Sport Prediction Engine SDK V1 exposes 4 market capabilities, supports 3 in V1, validates 8 deterministic prediction checks, returned recommendation `recommended`, model probability 61.4, edge 9.02, expected value 17.22 and made zero provider calls.
- MLB Feature Store Integration V1 validates a partial MLB moneyline feature set, preview quality 40, sufficiency 40, no-leakage true, 4 missing MLB-specific domains, no migration required and zero provider calls.
- MLB Prediction Engine V1 generated 3 deterministic previews across moneyline, spread/run line and total; validation passed 9 of 9 checks with quality 40, sufficiency 40, no-leakage true, no persistence, no production recommendations and zero provider calls.
- NFL Feature Store Integration V1 validates a partial NFL spread feature set, preview quality 40, sufficiency 40, no-leakage true, 4 missing NFL-specific domains, no migration required and zero provider calls.
- NFL Prediction Engine V1 generated 4 deterministic previews across moneyline, spread, total and first-half; validation passed 9 of 9 checks with quality 40, sufficiency 40, no-leakage true, no persistence, no production recommendations and zero provider calls.
- Soccer Feature Store Integration V1 validates a partial soccer moneyline feature set, preview quality 40, sufficiency 40, no-leakage true, 4 missing soccer-specific domains, no migration required and zero provider calls.
- Soccer Prediction Engine V1 generated 10 deterministic previews across 1X2, double chance, draw no bet, total, BTTS, first-half, qualification and Asian handicap contracts; validation passed 14 of 14 checks with three-way probability sum 100, quality 40, sufficiency 10, no-leakage true, no persistence, no production recommendations and zero provider calls.
- NHL Feature Store Integration V1 validates a partial NHL moneyline feature set, preview quality 40, sufficiency 40, no-leakage true, 5 missing NHL-specific domains, no migration required and zero provider calls.
- NHL Prediction Engine V1 generated 3 deterministic previews across moneyline, puck line/spread and total; validation passed 9 of 9 checks with quality 40, sufficiency 40, no-leakage true, no persistence, no production recommendations and zero provider calls.
- Tennis Feature Store Integration V1 validates a partial tennis moneyline feature set, preview quality 40, sufficiency 40, no-leakage true, 4 missing tennis-specific domains, no migration required and zero provider calls.
- Tennis Prediction Engine V1 generated 2 deterministic previews across moneyline and total; validation passed 9 of 9 checks with quality 40, sufficiency 40, no-leakage true, no persistence, no production recommendations and zero provider calls.
- UFC Feature Store Integration V1 validates a partial UFC moneyline feature set, preview quality 40, sufficiency 40, no-leakage true, 5 missing UFC-specific domains, no migration required and zero provider calls.
- UFC Prediction Engine V1 generated 2 deterministic previews across moneyline and method contract; validation passed 10 of 10 checks with quality 40, sufficiency 40, no-leakage true, moneyline settlement compatible, method settlement explicitly false, no persistence, no production recommendations and zero provider calls.
- Unsupported player, injury and lineup domains must return warnings or empty typed responses, not fabricated records.

## Current Endpoint Count

There are 182 `src/app/api/**/route.ts` files.

## Last Successful Build

`npm.cmd run build` completed with exit code 0 on 2026-07-13 after tightening the SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 to a 2-call cap, adding request timeout handling and wiring `sport_lineups` persistence for the applied migration. The build compiled successfully, passed TypeScript and generated 175 static pages.

## Next Recommended Module

Update the SportsDataIO NBA depth-chart and starting-lineup normalizers against the observed trial/scrambled provider payload shape before any further live lineup/depth execution.

Dependency reasoning: Historical Import Engine Core V1 defines import planning, Provider Adapter SDK V1 defines provider contracts, SportsDataIO Adapter Contract V1 maps SportsDataIO, SportsDataIO Historical Import Execution Readiness V1 adds guarded execution architecture, NBA Pilot Import V1 proved the narrow trial event path, Pilot Import V2 proved standings/team-stat/game-stat persistence under trial isolation, Players Pilot V1 proved roster/player mapping persistence, Injuries Pilot V1 proved injury persistence with unresolved-player warnings, and NBA Injury and Lineup Confidence Integration V1 now routes stored injury availability into feature quality, sufficiency, prediction safety, explanations and model health. The depth-chart and starting-lineup endpoint paths and migration are confirmed, but the trial payload shape did not match the current player/team/event key extraction logic, so persistence remains empty rather than fabricated. Broader provider-backed NBA reconciliation Phase B still requires explicit quota/date-window approval because the dry-run data-quality plan estimates hundreds of provider calls.

## Handoff Notes

- Read `AGENTS.md`, this file and `docs/MASTER_ROADMAP.md` before autonomous work.
- Do not start the next module unless the user asks for autonomous module execution.
- Preserve the current API route surface and dashboard panels.
- Update this file after every completed module with build result, blockers and next recommended work.

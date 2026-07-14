# Decision Log

## 2026-07-14 - Add Production Data Gate V1 After NBA Trial Validation

Context: The NBA trial validation batch produced 27 settled trial predictions. The totals market finished 0-9, requiring a technical audit before any production-readiness expansion. The audit showed all 9 total predictions were Overs and all 9 completed game totals stayed under their trial lines, so settlement was correct and no rows needed correction.

Decision: Add one shared `production_data_gate_v1` service and wire it into existing production-facing feature validation, prediction persistence, settlement metrics, backtesting/calibration, CLV, model metrics, model learning, adaptive weights, recommendations, pattern discovery, AI Coach and closing-line intelligence surfaces. Preserve NBA trial evidence under explicit `trialTechnicalValidation` sections and exclude it from production summaries.

Consequences: Trial/scrambled rows remain useful for transport, normalization, lineage, settlement and idempotency validation, but cannot improve production confidence, production recommendations, ROI, CLV, calibration, model learning or model promotion. The next executable production step is an explicitly approved first real-data validation window with non-trial, non-scrambled, production-eligible rows.

Affected modules: Production Data Gate, Feature Store Core, Prediction History, NBA Backtesting/Calibration, Settlement Core, CLV, analytics, model learning, adaptive weights, top picks, AI Coach and production-readiness docs.

## 2026-07-14 - Complete NBA Trial Validation Batch V1

Context: The first end-to-end NBA trial validation proved 5 linked trial predictions with genuine cutoff-safe offered prices. The next requested phase was to scale the same proven flow to a bounded 20-50 prediction batch using existing persisted trial data and existing provider integrations only.

Decision: Keep the existing Feature Store route and service architecture. Extend the bounded trial caps to 50 and make snapshot odds market-specific so moneyline, spread and total candidates use their own offered prices and lines. Run `historical_feature_snapshot_write_pilot` twice with 9 events, 3 markets and 50 snapshots, then run `historical_prediction_snapshot_lineage_pilot` twice with 50 snapshots and 50 predictions. Do not add routes, migrations, dashboards or provider calls.

Consequences: The batch used 0 provider calls, inserted 27 market-specific trial snapshots on first snapshot run and reused all 27 on rerun. Prediction lineage inserted 22 new trial predictions, reused 5 existing predictions, settled 22 newly inserted predictions, and then reused all 27 on immediate rerun with 0 additional settlement updates. Final linked trial state is 27 settled predictions across moneyline, spread and total, with 9 wins, 18 losses, 0 pushes, 0 voids, 0 duplicate prediction identities, 0 duplicate snapshot links and 0 production leakage. The result is technical trial validation only; production ROI, CLV, calibration and model promotion remain blocked.

Affected modules: Historical Feature Generation, Feature Store route, NBA Prediction Settlement, NBA Backtesting/Calibration, SportsDataIO trial odds documentation and governance docs.

## 2026-07-14 - Complete Corrected Priced Odds And Trial Lineage Verification

Context: After the initial SportsDataIO `GameOddsByDate/2025-12-26` run and alternate-like cleanup, 540 intended full-game trial odds rows remained, but 180 retained legacy moneyline rows still had invalid non-null line values. The user approved exactly one corrected provider retry and deletion of exactly proven superseded legacy moneyline rows.

Decision: Reuse the existing historical import execution path for one corrected `GameOddsByDate/2025-12-26` call. The retry returned HTTP 200 with 9 top-level game records, produced 540 normalized `PregameOdds` rows, inserted 180 corrected null-line moneylines and updated 360 spread/total rows. After verifying 180 corrected replacements, 0 feature-snapshot references and 0 prediction references, delete exactly 180 legacy non-null-line moneylines and record audit metadata on both priced-odds sync jobs. Create five odds-enriched trial feature snapshot versions and run the existing bounded lineage pilot with provider calls 0.

Consequences: Final SportsDataIO trial odds state is 540 rows: 180 moneyline, 180 spread and 180 total, with 0 legacy moneylines, 0 duplicate logical rows and 0 production leakage. The lineage pilot inserted 5 trial/scrambled/non-production predictions, settled them locally as 3 wins and 2 losses, and reused all 5 rows on immediate rerun. Production recommendations, real ROI, CLV, calibration, model promotion and confidence improvement remain blocked because the rows are trial-only and lack genuine closing snapshots.

Affected modules: SportsDataIO historical import execution, `sports_odds_snapshots`, Historical Feature Trial Lineage Pilot, NBA Backtesting/Calibration, NBA Prediction Settlement and governance docs.

## 2026-07-14 - Stop Priced Game Odds Pilot After Partial Trial Persistence

Context: Historical Feature Trial Lineage Pilot V1 was blocked because 15 durable NBA trial snapshots had no genuine offered price. The next approved step was a capped SportsDataIO `GameOddsByDate` pilot through the existing historical import execution route, with at most 2 sequential provider calls and no alternate/live odds.

Decision: Extend the existing SportsDataIO NBA odds pilot path to use `GameOddsByDate/{date}` as the priced source and select `2025-12-26` from stored trial event provider-day evidence. The first live call returned HTTP 200 with 9 game records and persisted 1,476 trial/scrambled/non-production odds rows. The job was stopped as `partial`: the service validation read only the first 1,000 rows and the first-run normalizer traversed `AlternateMarketPregameOdds`, producing 936 alternate-like rows outside the pilot scope. The code now skips alternate/live odds arrays, keeps moneyline `line=null`, requires mapped `sport_events`, and validates persisted IDs by chunks.

Consequences: The endpoint and priced payload shape are confirmed, but the pilot is not complete and the lineage retry remains blocked. No second provider call, prediction persistence, settlement, backtesting, calibration, model training or production recommendation was run. Cleanup/quarantine of the trial-only alternate-like rows requires explicit approval before a corrected retry.

Affected modules: SportsDataIO historical import execution, `sports_odds_snapshots`, Historical Feature Trial Lineage Pilot and governance docs.

## 2026-07-14 - Clean Up Alternate-Like Trial Odds Rows

Context: The first `GameOddsByDate/2025-12-26` run persisted 1,476 trial-only odds rows, including 936 rows from `AlternateMarketPregameOdds` that were outside the approved full-game pregame pilot.

Decision: Use a narrow deterministic selector over `sports_odds_snapshots`: NBA sport/league, provider `sportsdataio`, metadata import module `sportsdataio_nba_betting_odds_pilot_v1`, trial/scrambled/non-production flags and `sourcePath` attributable to `AlternateMarketPregameOdds`. The pre-deletion audit found 1,476 total pilot rows, 540 intended `PregameOdds` rows, 936 alternate-like rows, 0 live rows, 0 ambiguous rows and 0 feature-snapshot/prediction references. Delete the 936 alternate-like rows in chunks and record the exact deleted ID list plus checksum in sync-job metadata.

Consequences: The pilot scope now retains 540 trial-only full-game pregame rows and 0 alternate/live rows. Prediction lineage was not retried because the retained 180 moneyline rows still carry pre-fix non-null line values and old deterministic IDs. Future work needs explicit approval to correct or supersede those moneyline rows before using the prices for lineage.

Affected modules: `sports_odds_snapshots`, SportsDataIO historical import execution, Historical Feature Trial Lineage Pilot and governance docs.

## 2026-07-14 - Block Trial Prediction Lineage Without Genuine Offered Prices

Context: Historical Feature Snapshot Persistence V1 produced 15 durable NBA trial snapshots. The next Production Readiness Phase 1 check was to validate Prediction -> Snapshot -> Settlement -> Backtest lineage without provider calls, production recommendations or fabricated market data.

Decision: Extend the existing `/api/features/store` route with action `historical_prediction_snapshot_lineage_pilot`. The pilot reads at most 15 trial snapshots, permits at most 5 prediction rows, requires stable snapshot/event/market lineage, preserves trial/scrambled/non-production flags and refuses existing prediction identities with incompatible snapshot lineage. Runtime validation found all 15 trial snapshots lacked a genuine offered price. Because `prediction_history.odds` is not nullable and odds must not be fabricated, the pilot returns `no_eligible_candidates` and inserts no prediction rows.

Consequences: The lineage write path is implemented but safely blocked by priced-odds dependency. No provider calls, new routes, production predictions, settlement mutations, ROI/CLV/calibration metrics or model-training actions were created. The next dependency is genuine priced odds snapshot persistence or an explicit schema decision for no-price watch-only prediction contracts.

Affected modules: Historical Feature Generation, Feature Store route, Historical Import plan, Daily Sync V2, NBA Backtesting/Calibration, NBA Prediction Settlement and governance docs.

## 2026-07-14 - Verify Historical Feature Snapshot Write-Mode Pilot

Context: Runtime schema probing confirmed `historical_feature_snapshots` and `prediction_history` lineage columns were applied, but Production Readiness Phase 1 still needed a safe server-side write path and idempotency proof before durable snapshots could be considered operational even for trial data.

Decision: Extend the existing Feature Store route with a `historical_feature_snapshot_write_pilot` action over `historical-feature-generation.service.ts`. The write path uses stored normalized NBA rows only, enforces `trial=true`, `scrambled=true`, `production_eligible=false`, caps the pilot at 5 events, 3 markets per event and 15 snapshots, inserts only missing deterministic keys, reuses identical existing snapshots and rejects changed-lineage overwrites. The verified run inserted 15 trial snapshots, then immediately reran the same bounded batch and reused all 15 with 0 inserts, 0 duplicates, 0 partial failures and 0 provider calls.

Consequences: Durable snapshot persistence is now verified for bounded trial writes without adding routes, migrations, provider calls or prediction mutations. Production backtesting, ROI, CLV, calibration and promotion remain blocked until production-eligible predictions link to durable snapshots and include valid prices, genuine closing snapshots and enough settled production samples.

Affected modules: Historical Feature Generation, Feature Store route, Historical Import plan, Daily Sync V2, NBA Backtesting/Calibration and governance docs.

## 2026-07-14 - Replace Static Migration Assumptions With Runtime Schema Probes

Context: After `historical_feature_snapshots`, `sport_player_stats`, `sport_lineups` and `prediction_history.feature_snapshot_id` were confirmed in the configured Supabase project, runtime readiness still reported migration-pending or unsupported states because service contracts used static placeholders and index-rotated domain natural keys.

Decision: Add `src/lib/server-schema-capabilities.ts` as a server-only Supabase schema capability probe. Existing Feature Store validation, historical import planning and NBA backtest/calibration responses now use probe results to report `applied`, `missing`, `permission_blocked`, `configuration_missing`, `probe_failed` or `unknown`. Correct NBA historical import domain manifests with per-domain destination tables, conflict targets and natural keys, and distinguish pilot-validated current/date/season feeds from unsupported generic planner execution.

Consequences: Runtime responses no longer treat a local migration filename as pending when the remote schema is selectable. NBA players, injuries, lineups and player stats are reported as pilot-validated/trial-gated instead of unsupported. Backtesting remains legitimately blocked when no linked snapshots, prices, closing snapshots or settled production samples exist.

Affected modules: Server schema capabilities, Historical Feature Generation, Historical Import Engine, NBA Backtesting/Calibration and governance docs.

## 2026-07-14 - Add Historical Feature Snapshot Persistence V1

Context: Production Readiness Phase 1 was blocked because historical feature generation could only produce dry-run or inline feature context. Production backtesting, ROI, CLV and calibration need durable prediction-time feature snapshots with stable lineage, immutability and trial isolation.

Decision: Add pending additive migration `202607140001_historical_feature_snapshots_v1.sql` for a generic `historical_feature_snapshots` table and `prediction_history` lineage columns. Extend the existing historical feature generation service, Feature Store validation route, historical import plan, NBA daily sync dry-run and NBA backtest/calibration responses with migration-pending persistence readiness, deterministic persistence keys, linked-snapshot immutability, nonnegative dry-run persistence counters and deterministic validation for one-to-many expansion, batch dedupe, ROI/CLV blockers and cancellation/resume behavior.

Consequences: The repository now has a concrete durable lineage schema ready for manual Supabase application without adding routes, provider calls or automatic migrations. Production backtesting/calibration remains blocked until the migration is applied and verified; inline `prediction_history.feature_snapshot` remains legacy context rather than canonical durable lineage.

Affected modules: Historical Feature Generation Orchestrator, Feature Store validation, Historical Import Engine, NBA Daily Sync, NBA Backtesting/Calibration and production-readiness docs.

## 2026-07-14 - Expand Settlement Core Multi-Sport Fixture Coverage

Context: Production Readiness Phase 1 called for deterministic settlement hardening after historical feature work, but props and sportsbook-specific semantics should not be claimed without grading feeds and result-type metadata.

Decision: Extend `settlement-core.service.ts` through the existing `/api/settlement/core` response with multi-sport deterministic fixture coverage for NBA, MLB, NFL, NHL and Soccer. Cover moneyline/spread/total equivalents, first-half/quarter/period score-basis contracts, overtime/extra-innings inclusion, push and void scenarios. Keep soccer draw, double chance, extra-time/penalties, two-leg aggregate and props as contract-only where generic primitives lack dedicated metadata.

Consequences: Settlement readiness is clearer across the shared markets without adding routes, migrations or provider calls. The project still avoids unsupported production claims for props, soccer special markets and sportsbook-specific settlement rules.

Affected modules: Settlement Core V2 and production-readiness docs.

## 2026-07-14 - Add Historical Feature Generation Orchestrator V1

Context: Production Readiness Phase 1 needed a shared feature-generation layer that can produce leakage-safe pregame feature contracts from normalized stored data before backtesting, calibration or production predictions consume historical context.

Decision: Add `historical-feature-generation.service.ts` as a dry-run orchestrator over persisted normalized records only. It defines deterministic historical feature snapshot IDs, sport/event/market/cutoff/model/feature-set identity, trial/scrambled/production flags, lineage metadata, checkpoint/resume/cancel contracts, nonnegative counters and backtest input readiness. Extend existing `/api/features/store/validation` with 12 deterministic leakage fixtures instead of adding a new route. Extend the existing historical import plan, NBA daily sync contract, Daily Sync V2 output and NBA backtest/calibration responses with feature-generation/backtest readiness handoffs.

Consequences: Historical feature generation is now contract-complete for local validation and orchestration, while durable persistence remains explicitly blocked pending an approved generic additive migration. Provider calls remain 0, API route count remains 205 and production ROI/CLV/calibration cannot use trial or unstored feature snapshots as real evidence.

Affected modules: Feature Store Core, Historical Import Engine, NBA Daily Sync orchestration, Daily Sync V2, NBA Backtesting/Calibration and production-readiness docs.

## 2026-07-14 - Add Historical Import Engine V2 Planning Manifests

Context: Production Readiness Phase 1 prioritizes trustworthy, automatically maintained predictions through shared product layers. The historical import planner already existed, but its multi-sport planning contract did not include NBA and did not distinguish provider records from normalized rows, readiness state, dependency graphs, scope types or handoff contracts strongly enough for the next production-readiness steps.

Decision: Extend the existing `/api/historical-import/plan` response with `historical_import_multi_sport_planning_v2` instead of adding routes. The planner now returns NBA, MLB, NFL, NHL and Soccer domain manifests with dependency indexes, scope metadata, readiness classifications, execution mode, provider-call and maximum-record budgets, stable ID components, conflict targets, one-to-many expansion flags and validation/feature-generation/settlement/backtesting handoffs. Add deterministic local validation covering priority-sport coverage, zero provider calls, concurrency `1`, retries disabled, trial isolation defaults, stable dependency indexes and the 39 provider records -> 758 normalized rows nonnegative-counter fixture.

Consequences: The shared historical import layer is more execution-ready without consuming provider quota, creating migrations or increasing the 205-route API surface. Live imports remain blocked until explicit provider, endpoint, quota, migration and production-promotion approvals are granted.

Affected modules: Historical Import Engine Core, historical import plan route contract and production-readiness governance docs.

## 2026-07-14 - Add Shared SportsDataIO Betting Market Normalization Core

Context: The NBA BettingEvents pilot proved that SportsDataIO betting payloads can be event/market discovery data rather than priced sportsbook snapshots. Future NBA and multi-sport odds work needed identifier-safe, provider-independent classification before any more live calls.

Decision: Add `sportsdataio-betting-normalizer.service.ts` with deterministic fixtures for empty market arrays, market IDs only, nested markets, priced `BettingOutcomes`, separate consensus outcomes, discovery-only events, unlisted outcomes, entitlement-blocked statuses and archive-required routing. Wire the existing NBA odds executor and runtime validation to the shared classifier and counters. Extend runtime capabilities with a zero-call `betting_metadata` domain and register the exact NBA odds endpoints in the existing catalog, including `LiveGameOddsByDate` while keeping the misspelled `LveGameOddsByDate` uncataloged.

Consequences: The importer no longer risks using `GameID`, `BettingMarketID` or trial mapping IDs as `BettingEventID`. Discovery records are counted separately from priced outcomes and are not reported as skipped snapshots. Older events are routed to `archiveRequired=true` without inventing Historical API paths. No provider calls, migrations or API routes were added.

Affected modules: SportsDataIO betting normalizer, SportsDataIO historical import execution, runtime adapter capabilities, endpoint catalog and provider docs.

## 2026-07-14 - Classify SportsDataIO NBA BettingEvents As Discovery-Only

Context: The first SportsDataIO NBA odds pilot reached `BettingEventsByDate/2025-12-26` but treated zero normalized `sports_odds_snapshots` rows as a failure. A follow-up needed to distinguish discovery/index records from priced sportsbook outcome snapshots.

Decision: Extend the existing `/api/historical-import/execute` odds path with sanitized payload-shape capture, BettingEvents relationship classification and deterministic fixtures for direct snapshot rows versus discovery-only records. The capped verification used 2 sequential provider calls: `BettingEventsByDate/2025-12-26` returned HTTP 200 with 9 discovery records and nested `BettingMarkets`; `BettingMarkets/22888` returned HTTP 200 with 0 records. The sync job completed as discovery-only with 0 inserted/updated odds rows and `records_skipped=0`.

Consequences: SportsDataIO BettingEvents is no longer misreported as a failed odds-snapshot import when it behaves as discovery data. No unsupported sportsbook names, prices, lines or outcomes are fabricated. Production predictions, CLV, ROI, backtesting, calibration and model training remain disabled until the exact priced-outcome endpoint is confirmed.

Affected modules: SportsDataIO historical import execution readiness, SportsDataIO NBA odds readiness, `sports_odds_snapshots`, SportsDataIO provider catalog.

## 2026-07-14 - Add SportsDataIO Canonical Endpoint Catalog

Context: Multi-sport SportsDataIO work needed one maintainable list of exact endpoint templates and implementation state instead of duplicating endpoint notes across readiness docs.

Decision: Add `src/config/sportsdataio-endpoint-catalog.ts` as typed provider metadata for NBA, MLB, NFL, NHL and Soccer, with concise docs under `docs/providers/sportsdataio/`. The catalog tracks sport, API version, domain, path template, parameter format, return type, call interval, production/historical purpose, trial status, entitlement status, implementation status, normalization status, persistence status and last pilot status.

Consequences: Future SportsDataIO pilots can check exact paths and status from one typed source without adding routes or dashboard cards. The catalog makes zero provider calls and does not authorize production use.

Affected modules: Provider documentation, SportsDataIO multi-sport planning.

## 2026-07-13 - Add NBA Daily Sync Orchestration Contract V1

Context: The repository already had NBA sync, data-health, Feature Store preview, prediction preview, settlement and data-quality routes, but operators did not have one typed NBA daily workflow contract tying those existing surfaces together.

Decision: Extend existing NBA sync status and data-health responses with `nba_daily_sync_orchestration_contract_v1`, an ordered 10-step workflow for schedules, results, injuries, lineups, team stats, player stats, Feature Store preview, prediction preview, settlement and data-quality audit. Surface its summary in the existing NBA Data Sync panel. Keep default provider calls at 0, concurrency at 1, automatic retries disabled and production safety gates closed for trial-only or externally blocked domains.

Consequences: Operators can inspect the NBA daily sequence, checkpoints and blocked production refreshes without another route, dashboard module, provider call or migration. Existing sync execution behavior is preserved.

Affected modules: NBA Data Sync V1, NBA Data Sync dashboard, NBA Feature Store Integration V1, NBA Data Quality Phase A, NBA Prediction Settlement V1.

## 2026-07-13 - Add NBA Player Stats Feature Quality Integration V1

Context: SportsDataIO NBA Player Stats Pilot V1 persisted trial-isolated `sport_player_stats` rows, but Feature Store Core and NBA feature previews did not yet expose player-stat coverage, mapping quality or trial confidence gates as a typed feature context.

Decision: Add optional `player_stats_context` to Feature Store Core and NBA moneyline/spread/total feature sets. Extend the NBA Feature Store preview/status path to read stored `sport_player_stats`, report season/game row counts, unresolved mappings, freshness, trial rows and production-confidence eligibility, and surface the same summary in the existing NBA Feature Store dashboard. Extend the existing NBA data-quality APIs to audit injuries and lineups for unresolved mappings, stale feeds, duplicate lineup keys, invalid depth order and trial/production contamination.

Consequences: Stored NBA player stats now participate in feature-quality and sufficiency contracts without changing prediction generation, adding routes, adding migrations or making provider calls. Trial-only player stats, injuries and lineups continue to create warnings or penalties and cannot improve production confidence, backtesting, calibration or model training.

Affected modules: Feature Store Core V1, Multi-Sport Feature Registry V1, NBA Feature Store Integration V1, NBA Data Quality Phase A, NBA Feature Store dashboard.

## 2026-07-13 - Complete SportsDataIO NBA Player Stats Pilot V1

Context: The `sport_player_stats` migration was applied remotely and SportsDataIO confirmed player season and game stat endpoint paths.

Decision: Add a narrow approved player-stat pilot path to the SportsDataIO historical import executor for `/v3/nba/stats/json/PlayerSeasonStats/2026` and `/v3/nba/stats/json/PlayerGameStatsByDate/2025-12-26`, capped at exactly 2 sequential provider calls with no retry. Persist normalized rows into `sport_player_stats`, write `player_stat` provider mappings, keep all rows trial/scrambled/non-production-eligible and validate quality, feature preview and trial isolation without prediction persistence.

Consequences: The pilot persisted 918 player-stat rows and 918 provider mappings with zero duplicate IDs, zero unresolved teams/events, 203 unresolved player mappings preserved safely and zero production leakage. The first run completed provider and persistence work but hit a post-persistence audit compatibility bug because `sport_game_stats` stores trial metadata in `stats`, not `metadata`; the audit was fixed and sync job `777f9ac7-efeb-4396-a007-259557dfdcf8` was completed from local validation without another provider call.

Affected modules: SportsDataIO historical import execution readiness, SportsDataIO NBA player stats readiness, SportsDataIO NBA trial isolation audit, NBA data quality, NBA Feature Store preview.

## 2026-07-13 - Consolidate SportsDataIO NBA Readiness Surface

Context: Several focused SportsDataIO NBA readiness routes and dashboard cards duplicated proof, evidence, audit, blocker and next-action data already available from the aggregate NBA readiness response.

Decision: Make `/api/providers/sportsdataio/nba/readiness` the canonical NBA readiness route. Preserve `/domain-proof`, `/completion-evidence`, `/objective-audit` and `/safe-next-actions` as compatibility aliases with non-breaking alias metadata. Preserve odds/player-props endpoint preflights and player-stats migration preflight as operational aliases for focused approval checks, while embedding their summaries into the aggregate readiness response for dashboard use.

Consequences: Existing consumers keep their focused route contracts, new consumers have one canonical readiness surface, and the Historical Import dashboard renders one Readiness Summary while dropping duplicate client fetches for odds, player-props and player-stats readiness. No routes, provider calls, migrations or mutations were added.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine panel, SportsDataIO NBA readiness documentation.

## 2026-07-13 - Add SportsDataIO NBA Player Props Endpoint Preflight API

Context: Player-props readiness included `endpointPreflight`, but operator approval for prop markets and settlement needed a focused zero-call route for endpoint, entitlement, sportsbook coverage and grading-rule gates.

Decision: Add `/api/providers/sportsdataio/nba/player-props/endpoint-preflight` as a read-only endpoint over the player-props endpoint preflight, required confirmations, capped pilot constraints, persistence contract and validation blockers.

Consequences: Operators can inspect prop endpoint and settlement readiness directly without provider calls, Supabase mutations, prediction persistence, settlement, backtesting or model training.

Affected modules: SportsDataIO NBA Player Props Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Odds Endpoint Preflight API

Context: Odds readiness included `endpointPreflight`, but operator approval for current odds and historical odds needed a focused zero-call route for endpoint, entitlement, sportsbook coverage and historical-window gates.

Decision: Add `/api/providers/sportsdataio/nba/odds/endpoint-preflight` as a read-only endpoint over the odds endpoint preflight, required confirmations, capped pilot constraints, persistence contract and validation blockers.

Consequences: Operators can inspect odds/historical-odds readiness directly without provider calls, Supabase mutations, CLV activation, backtesting, model training or production prediction use.

Affected modules: SportsDataIO NBA Odds Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Player Stats Migration Preflight API

Context: Player-stat readiness included `migration.preflight`, but database-admin verification needed a focused zero-call route for the additive `sport_player_stats` migration gates.

Decision: Add `/api/providers/sportsdataio/nba/player-stats/migration-preflight` as a read-only endpoint over the migration preflight, expected columns/indexes, verification SQL, persistence contract and endpoint blockers.

Consequences: Operators can inspect migration readiness directly without provider calls, Supabase mutations, automatic migration application, prediction persistence, backtesting or model training.

Affected modules: SportsDataIO NBA Player Stats Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Safe Next Actions API

Context: The aggregate SportsDataIO NBA readiness response included handoff `safeNextActions`, but operators did not have a direct zero-call route focused on allowed local actions and still-closed production gates.

Decision: Add `/api/providers/sportsdataio/nba/safe-next-actions` as a read-only endpoint over the handoff safe-next-actions list, production gates, provider execution gate, next-pilot approval checklist, blocker-resolution checklist and production-usage exclusion audit.

Consequences: Operators can retrieve allowed next steps directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training, and readiness surface audits can require the safe-next-actions route across operator surfaces.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Objective Audit API

Context: The aggregate SportsDataIO NBA readiness response included `objectiveAudit`, but operators did not have a direct zero-call route focused on objective-level remaining work and completion blockers.

Decision: Add `/api/providers/sportsdataio/nba/objective-audit` as a read-only endpoint over the objective audit, completion evidence matrix, domain completion proof ledger and blocked-state audit.

Consequences: Objective-level completion state can be retrieved directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training, and readiness surface audits can require the objective audit route across operator surfaces.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Completion Evidence API

Context: The aggregate SportsDataIO NBA readiness response included `completionEvidenceMatrix`, but operators did not have a direct zero-call route focused on requirement-level proof, unresolved evidence and goal-completion blockers.

Decision: Add `/api/providers/sportsdataio/nba/completion-evidence` as a read-only endpoint over the completion evidence matrix, domain completion proof ledger, objective audit and external blocker ledger.

Consequences: Requirement-level completion evidence can be retrieved directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training, and readiness surface audits can require the completion evidence route across operator surfaces.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Domain Proof API

Context: The aggregate SportsDataIO NBA readiness response included `domainCompletionProofLedger`, but operators did not have a direct zero-call route focused on domain-by-domain proof state and completion-blocking gaps.

Decision: Add `/api/providers/sportsdataio/nba/domain-proof` as a read-only endpoint over the domain completion proof ledger, completion evidence matrix, external blocker ledger and provider execution gate.

Consequences: Domain-level proof and completion-blocking evidence can be retrieved directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training, and readiness surface audits can require the domain proof route across operator surfaces.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Production Gate API

Context: The aggregate SportsDataIO NBA readiness response included `productionGateAudit`, but operators did not have a direct zero-call route focused on proving production gates remain closed while external blockers remain.

Decision: Add `/api/providers/sportsdataio/nba/production-gate` as a read-only endpoint over the production gate audit, provider execution gate, external blocker ledger and production-usage exclusion audit.

Consequences: Production-gate closure evidence can be retrieved directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training, and readiness surface audits can require the production gate route across operator surfaces.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Blocker Resolution API

Context: The aggregate SportsDataIO NBA readiness response included `externalBlockerResolutionChecklist`, but operators did not have a direct zero-call route focused on required evidence, resolution steps and forbidden actions before any future capped pilot can reopen.

Decision: Add `/api/providers/sportsdataio/nba/blocker-resolution` as a read-only endpoint over the blocker resolution checklist, blocker ledger, provider execution gate, production gate audit and production-usage exclusion audit.

Consequences: Blocker-resolution evidence can be retrieved directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training, and readiness surface audits can require the resolution route across operator surfaces.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Production Usage Exclusion API

Context: The aggregate SportsDataIO NBA readiness response included `productionUsageExclusionAudit`, but operators did not have a direct zero-call route focused on proving trial rows cannot enable production prediction, backtesting, model training or confidence lift.

Decision: Add `/api/providers/sportsdataio/nba/production-usage-exclusion` as a read-only endpoint over the production-usage exclusion audit, provider execution gate, production gate audit and external blocker ledger.

Consequences: Production-use exclusion evidence can be retrieved directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training, and readiness surface audits can require the exclusion route across operator surfaces.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Provider Gate API

Context: The aggregate SportsDataIO NBA readiness response included the closed provider execution gate, but operators did not have a direct zero-call route focused on the go/no-go state.

Decision: Add `/api/providers/sportsdataio/nba/provider-gate` as a read-only endpoint over the provider execution gate, blocker ledger, resolution checklist, production gate audit and production-usage exclusion audit.

Consequences: Provider execution status can be retrieved directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training, and readiness surface audits can require the gate route across operator surfaces.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA External Blockers API

Context: The aggregate SportsDataIO NBA readiness response included the external blocker ledger and resolution checklist, but operators did not have a direct zero-call route focused on unresolved external blockers.

Decision: Add `/api/providers/sportsdataio/nba/external-blockers` as a read-only endpoint over the blocker ledger, resolution checklist, provider execution gate, production gate audit and production-usage exclusion audit.

Consequences: External blocker ownership, evidence requirements and closed production gates can be retrieved directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Contract Audit API

Context: The aggregate SportsDataIO NBA readiness response included `responseShapeAudit` and `surfaceConsistencyAudit`, but there was no direct zero-call route for contract and surface-alignment verification.

Decision: Add `/api/providers/sportsdataio/nba/contract-audit` as a read-only endpoint over response-shape and surface-consistency audits, and expose the route in historical import and runtime observability surfaces.

Consequences: Operators can retrieve local API contract and surface parity evidence directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Evidence Export API

Context: The aggregate SportsDataIO NBA readiness response included a validated `readinessEvidenceExport`, but operators did not have a direct zero-call route for the handoff evidence bundle.

Decision: Add `/api/providers/sportsdataio/nba/evidence-export` as a read-only endpoint over existing readiness evidence, blocker, gate and domain-proof artifacts, and expose the route in historical import and runtime observability surfaces.

Consequences: Evidence handoff can be retrieved directly without provider calls, Supabase mutations, migrations, prediction persistence, backtesting or model training.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

## 2026-07-13 - Add SportsDataIO NBA Next-Pilot Preflight API

Context: The SportsDataIO NBA readiness service had the next-pilot approval checklist and closed provider execution gate, but operators lacked a direct zero-call preflight route that packaged the go/no-go state for a future capped pilot.

Decision: Add `/api/providers/sportsdataio/nba/next-pilot-preflight` as a read-only route over existing readiness artifacts, and declare it across readiness, historical import and runtime observability surfaces.

Consequences: Future pilot handoff can reference one compact preflight packet while provider calls, migrations, prediction persistence, backtesting and model training remain blocked until external evidence is supplied.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine panel.

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

## 2026-07-13 - Complete SportsDataIO NBA Lineup Trial Persistence Without Production Leakage

Context: The SportsDataIO NBA depth-chart and starting-lineup endpoints returned HTTP 200, but the first normalization rerun stopped during `sport_players` upsert because duplicate input rows collided with the `ON CONFLICT` target.

Decision: Deduplicate `sport_players`, `sport_lineups` and `provider_entity_mappings` batches by their conflict keys before upsert, then rerun the same capped trial with `maximumRequests=2`, `concurrencyLimit=1`, no retries and no prediction/backtest/training side effects. Persist only normalized trial/scrambled lineup/depth rows and provider mappings with `production_eligible=false`.

Consequences: The verified rerun completed sync job `ae45b0bd-57d9-4f58-9095-0f014781185c`, persisted 758 `sport_lineups` rows and 758 provider mappings, preserved 54 unresolved player references safely and kept trial rows excluded from production prediction and confidence-improvement paths. Future import reports should separate top-level provider records from flattened normalized rows so skipped counters cannot become negative.

Affected modules: SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1, SportsDataIO Historical Import Execution Readiness V1, NBA Injury and Lineup Confidence Integration V1, NBA Prediction Engine V1.

## 2026-07-13 - Separate Provider Record Counts From Flattened Normalized Rows

Context: SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 fetched 39 top-level provider records that flattened into 758 normalized lineup/depth rows. The previous reporting formula subtracted normalized rows from provider records, causing `sports_sync_jobs.records_skipped=-719` even though no normalized rows were skipped.

Decision: Keep the existing `records_skipped` column for backward compatibility but clamp it through a shared import counter helper so it can never be negative. Report `providerRecordsFetched`, `normalizedRowsProduced`, `skippedProviderRecords`, `skippedNormalizedRows`, `oneToManyExpansion` and `expansionRatio` in live response counters and sync-job metadata where the existing JSON metadata supports it. Do not add a migration.

Consequences: Future one-to-many SportsDataIO imports preserve accurate flattened-row reporting without breaking legacy jobs, dashboards or API consumers. The deterministic local readiness validation now covers the 39 -> 758 case and confirms `recordsSkipped=0`, `skippedProviderRecords=0` and `skippedNormalizedRows=0` with zero provider calls.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, Historical Import Engine Core jobs API, SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1.

## 2026-07-13 - Prepare NBA Player Stats Persistence Without Guessing Endpoints

Context: The large SportsDataIO NBA readiness objective prioritizes player season stats and player game stats, but the repository did not contain exact authenticated SportsDataIO endpoint paths for those feeds and did not have a dedicated player-stat persistence table.

Decision: Add zero-call player-stat readiness first. Create an additive `sport_player_stats` migration, add a readiness API with deterministic season/game stat fixtures, correct provider metadata so `player_stats` is distinct from roster `players`, add migration preflight SQL plus go/no-go gates, and keep live execution blocked until exact endpoint paths are confirmed.

Consequences: The project now has a concrete destination table, natural keys, conflict targets, dependency order, deterministic normalization, trial-isolation checks and manual migration verification guidance for NBA player stats. No provider calls were made, no migration was applied automatically and trial fixture rows cannot improve production confidence.

Affected modules: SportsDataIO NBA Player Stats Readiness V1, Provider Adapter SDK V1, SportsDataIO Adapter Contract V1, SportsDataIO Runtime Adapter, future player-stat pilot imports.

## 2026-07-13 - Expand NBA Data Quality To Cover Player Stats Readiness

Context: SportsDataIO NBA Player Stats Readiness V1 added an additive `sport_player_stats` migration, but the read-only NBA quality planner still focused on teams, events, game stats, standings, odds, mappings and predictions. The migration may not be applied in every environment yet.

Decision: Extend the existing NBA data-quality service to audit `sport_players` and optional `sport_player_stats` rows with zero provider calls. Treat a missing `sport_player_stats` table as an informational readiness issue rather than failing the entire audit.

Consequences: Player identity duplicates, unresolved player/team references, duplicate player-stat natural keys, missing game-event references, season mismatches and trial production-eligibility violations are visible before any live player-stat pilot. Existing quality routes stay backward compatible before the migration is applied.

Affected modules: NBA Data Quality Phase A, SportsDataIO NBA Player Stats Readiness V1, future player-stat imports, NBA Feature Store Integration V1.

## 2026-07-13 - Add Player Props Readiness Without Enabling Prop Betting

Context: Provider Intelligence and normalized markets already recognize `player_props`, but SportsDataIO contract/runtime metadata and readiness APIs did not expose an explicit NBA player props path. Exact SportsDataIO prop endpoints, market identifiers, sportsbook coverage and settlement rules are not confirmed.

Decision: Add contract-only SportsDataIO NBA Player Props Readiness V1. Represent `player_props` in the Provider SDK, SportsDataIO adapter contract, runtime capabilities and historical import dry-run planner; validate only a deterministic local over/under fixture; return endpoint and settlement preflight gates; use existing `sports_odds_snapshots` as the future persistence target; create no migration and make zero provider calls.

Consequences: The project can plan player prop import readiness without guessing provider paths or enabling prop recommendations. Future prop pilots now have a go/no-go checklist, while live prop execution, prediction persistence, backtesting, model training and settlement remain blocked until exact endpoints, entitlement and settlement rules are approved.

Affected modules: SportsDataIO NBA Player Props Readiness V1, Provider Adapter SDK V1, SportsDataIO Adapter Contract V1, SportsDataIO Runtime Adapter, Historical Import Engine Core V1, future Prop Bets Engine.

## 2026-07-13 - Add NBA Odds Readiness Before Any SportsDataIO Odds Calls

Context: SportsDataIO contract metadata includes odds and historical odds domains, and `sports_odds_snapshots` already exists, but there was no NBA-specific readiness API proving the intended row shape or recording exact endpoint, entitlement, sportsbook coverage and historical-window blockers.

Decision: Add SportsDataIO NBA Odds Readiness V1 as a zero-call local validation module. Validate deterministic moneyline, spread and total rows against the existing `sports_odds_snapshots` contract, return endpoint/entitlement preflight gates, create no migration and keep live odds/historical-odds execution blocked.

Consequences: Future capped odds pilots have explicit persistence keys, blocker reporting, trial-isolation gates and go/no-go checks before any provider quota is spent. Trial odds cannot feed production predictions, CLV, historical backtesting or model training.

Affected modules: SportsDataIO NBA Odds Readiness V1, SportsDataIO Adapter Contract V1, SportsDataIO Runtime Adapter, Historical Import Engine Core V1, NBA Multi-Book Comparison V1, NBA Steam Move Detection V1, future CLV modules.

## 2026-07-13 - Add Aggregate SportsDataIO NBA Integration Readiness

Context: The SportsDataIO NBA work now has several zero-call readiness surfaces plus completed trial pilots. Handoff and observability needed one endpoint that summarizes runtime validation, capability coverage, domain blockers and safety invariants without contacting providers.

Decision: Add SportsDataIO NBA Integration Readiness V1 as an aggregate local audit. Compose runtime adapter validation, capabilities, odds readiness, player prop readiness and player stat readiness into one response with explicit blockers, readiness areas and safety invariants. Extend the same response with a handoff matrix that separates trial-complete domains from production-blocked domains, production gates, objective completion audit and safe next actions, and display it in `HistoricalImportEnginePanel`. Also display next-pilot gate cards from the individual odds, player-props and player-stats readiness APIs.

Consequences: Operators can inspect the current SportsDataIO NBA integration state, final handoff gates, objective-audit gaps and specific next-pilot gates from one dashboard without spending quota or exposing secrets. The endpoint deliberately reports external blockers and does not treat trial imports as production-ready provider execution.

Affected modules: SportsDataIO NBA Integration Readiness V1, SportsDataIO Runtime Adapter, SportsDataIO NBA Odds Readiness V1, SportsDataIO NBA Player Props Readiness V1, SportsDataIO NBA Player Stats Readiness V1, Historical Import Engine Panel.

## 2026-07-13 - Add SportsDataIO NBA External Blocker Ledger

Context: The aggregate SportsDataIO NBA readiness endpoint identified external blockers, but operators also needed stable blocker IDs, ownership, evidence requirements and safe behavior while production gates remain closed.

Decision: Extend SportsDataIO NBA Integration Readiness V1 with an `externalBlockerLedger` for odds endpoints/entitlement, player-stat migration/endpoints, player-prop endpoints/settlement, historical reconciliation quota and trial-to-production validation. Display the ledger in `HistoricalImportEnginePanel` without adding provider calls, migrations, Supabase mutations or prediction workflow changes.

Consequences: The integration handoff is now machine-readable for blocked-state operation. Every blocker records zero pre-approval provider calls and closed production gates, so future pilots must resolve the documented evidence requirements before live or production-eligible execution.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, SportsDataIO NBA Odds Readiness V1, SportsDataIO NBA Player Props Readiness V1, SportsDataIO NBA Player Stats Readiness V1.

## 2026-07-13 - Add SportsDataIO NBA Readiness Evidence Export

Context: The aggregate readiness endpoint had objective audit, handoff and blocker-ledger sections, but final handoff still required operators to assemble proven capabilities, external blockers, closed guardrails and artifact references manually.

Decision: Add `readinessEvidenceExport` to SportsDataIO NBA Integration Readiness V1 and display its summary in `HistoricalImportEnginePanel`. The export is generated from local readiness services, repository docs and stored trial-pilot evidence, with zero provider calls and no database mutations.

Consequences: Operators now have a compact machine-readable handoff packet for the safe current state. It proves local/trial-scope readiness only, records external blockers and closed guardrails, and continues to block production execution, confidence improvement, backtesting, calibration and model training until external evidence is supplied.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, SportsDataIO NBA readiness documentation.

## 2026-07-13 - Validate SportsDataIO NBA Readiness Evidence Export

Context: The SportsDataIO NBA readiness evidence export created a compact local handoff packet, but consumers needed a deterministic signal that the export stayed internally consistent as blockers and guardrails evolve.

Decision: Add `readinessEvidenceExport.validation` with local checks for zero provider calls, unique evidence IDs, proven evidence presence, external-blocker parity, zero pre-approval call counts, closed production gates and artifact/evidence coverage. Display the validation summary in `HistoricalImportEnginePanel`.

Consequences: The handoff packet now self-reports whether it is structurally safe to consume. Validation remains local and read-only; it does not make provider calls, mutate Supabase, apply migrations or loosen production prediction gates.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, SportsDataIO NBA readiness documentation.

## 2026-07-13 - Consume SportsDataIO NBA Evidence Export Validation In Runtime Observability

Context: SportsDataIO NBA Integration Readiness V1 validates its readiness evidence export locally. Runtime observability already consumed readiness, blocker ledger and trial-isolation state, but did not independently surface whether the handoff packet was valid.

Decision: Extend `/api/observability/runtime` and `RuntimeObservabilityPanel` to include the readiness evidence export summary and validation status from the zero-call readiness service. Keep it reporting-only with no new route, provider call, mutation, migration or prediction workflow change.

Consequences: Operators can see evidence-export health from the general operational surface, not only the historical import handoff panel. A future inconsistency in the handoff packet can be detected without executing providers or loosening production gates.

Affected modules: Runtime Observability V1, SportsDataIO NBA Observability Integration V1, SportsDataIO NBA Integration Readiness V1, Runtime Observability Panel.

## 2026-07-13 - Add SportsDataIO NBA Readiness Response Shape Audit

Context: The aggregate SportsDataIO NBA readiness endpoint now carries handoff domains, objective audit, external blocker ledger, readiness evidence export and validation fields. A final local contract check was needed so response block and summary-count drift can be detected without invoking providers.

Decision: Add `responseShapeAudit` to SportsDataIO NBA Integration Readiness V1 and display it in `HistoricalImportEnginePanel`. The audit checks zero provider calls, local validation success, required response blocks, blocked-domain summaries, non-satisfied objective remaining work, external blocker gate closure, evidence export source-count parity and flattened blocker consistency.

Consequences: The aggregate readiness endpoint now self-reports local response contract health. The audit is read-only, makes no provider calls, mutates no data and does not imply production provider readiness.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, SportsDataIO NBA readiness documentation.

## 2026-07-13 - Surface SportsDataIO NBA Response Shape Audit In Runtime Observability

Context: SportsDataIO NBA Integration Readiness V1 now self-reports response-shape validity, but Runtime Observability V1 only consumed readiness blockers, the external blocker ledger, evidence export validation and trial-isolation state.

Decision: Extend `/api/observability/runtime` and `RuntimeObservabilityPanel` to include the zero-call readiness `responseShapeAudit`. Treat invalid response shape as an operational error while keeping valid-with-external-blockers as an amber blocked-state signal.

Consequences: Operators can now see aggregate readiness contract drift from the main runtime panel as well as the historical import handoff panel. The change is reporting-only and makes no provider calls, Supabase mutations, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: Runtime Observability V1, SportsDataIO NBA Observability Integration V1, SportsDataIO NBA Integration Readiness V1, Runtime Observability Panel.

## 2026-07-13 - Add SportsDataIO NBA Production Gate Audit

Context: The aggregate SportsDataIO NBA readiness response exposed production gates and blockers, but operators needed one deterministic local signal that production execution is still intentionally blocked until external evidence is supplied.

Decision: Add `productionGateAudit` to SportsDataIO NBA Integration Readiness V1 and display it in `HistoricalImportEnginePanel`. The audit checks zero provider calls, external blocker presence, closed production gates, zero pre-approval call counts, explicit blocked handoff domains, remaining objective work, closed guardrail evidence and readiness evidence validation.

Consequences: The readiness endpoint now proves that blocked production state is expected and internally consistent. The audit is reporting-only and makes no provider calls, Supabase mutations, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, SportsDataIO NBA readiness documentation.

## 2026-07-13 - Surface SportsDataIO NBA Production Gate Audit In Runtime Observability

Context: SportsDataIO NBA Integration Readiness V1 now returns `productionGateAudit`, but Runtime Observability V1 only consumed the external blocker ledger, evidence export validation, response-shape audit and trial-isolation state.

Decision: Extend `/api/observability/runtime` and `RuntimeObservabilityPanel` to include the zero-call production gate audit. Treat invalid production gate state as an operational error while keeping `production_blocked_as_expected` as an amber safe blocked-state signal.

Consequences: Operators can see whether SportsDataIO NBA production gates remain closed as expected from the general runtime panel as well as the historical import handoff panel. The change is reporting-only and makes no provider calls, Supabase mutations, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: Runtime Observability V1, SportsDataIO NBA Observability Integration V1, SportsDataIO NBA Integration Readiness V1, Runtime Observability Panel.

## 2026-07-13 - Align SportsDataIO NBA Readiness Architecture Documentation

Context: The implementation and module docs now include production gate audit and runtime-observability consumption, but the architecture overview still described only the blocker ledger, readiness evidence export and response-shape audit.

Decision: Update `docs/ARCHITECTURE.md` so the aggregate readiness and runtime observability architecture both name the production gate audit and its safe blocked-state role.

Consequences: The high-level architecture now matches the implemented zero-call readiness chain. This is documentation-only and makes no provider calls, migrations, Supabase mutations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, SportsDataIO NBA Observability Integration V1, Runtime Observability V1, Architecture documentation.

## 2026-07-13 - Add SportsDataIO NBA Next Pilot Approval Checklist

Context: The aggregate readiness response exposed blocker evidence and safe actions, but operators still had to infer a consolidated approval checklist before requesting future capped SportsDataIO NBA pilots.

Decision: Add `nextPilotApprovalChecklist` to SportsDataIO NBA Integration Readiness V1, deriving blocked domains, owner categories, required evidence, capped execution requirements, safe-until-approved behavior and zero pre-approval provider-call counts from the external blocker ledger. Display the summary in `HistoricalImportEnginePanel`.

Consequences: Future pilot requests have a single zero-call approval packet without enabling live execution. The checklist is declarative only and makes no provider calls, Supabase mutations, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, SportsDataIO NBA readiness documentation.

## 2026-07-13 - Surface SportsDataIO NBA Next Pilot Approval Checklist In Runtime Observability

Context: SportsDataIO NBA Integration Readiness V1 now returns `nextPilotApprovalChecklist`, but Runtime Observability V1 only consumed readiness blockers, the external blocker ledger, evidence export validation, production gate audit, response-shape audit and trial-isolation state.

Decision: Extend `/api/observability/runtime` and `RuntimeObservabilityPanel` to include the zero-call next-pilot approval checklist. Treat any checklist that was not generated without provider calls or that allows pre-approval provider calls as an operational error.

Consequences: Operators can see the same next-pilot approval domains, owners and zero-call pre-approval state from the general runtime panel as well as the historical import handoff panel. The change is reporting-only and makes no provider calls, Supabase mutations, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: Runtime Observability V1, SportsDataIO NBA Observability Integration V1, SportsDataIO NBA Integration Readiness V1, Runtime Observability Panel.

## 2026-07-13 - Add SportsDataIO NBA Completion Evidence Matrix

Context: The aggregate readiness endpoint exposed objective status and external blockers, but the long-horizon goal needed stricter proof coverage showing which evidence is verified, which evidence is unresolved and which items still block full completion.

Decision: Add `completionEvidenceMatrix` to SportsDataIO NBA Integration Readiness V1 and display it in `HistoricalImportEnginePanel`. The matrix records required evidence, proof artifacts, verified evidence, unresolved evidence and whether each requirement blocks full goal completion. Response-shape validation now checks matrix coverage and unresolved evidence for completion-blocking items.

Consequences: Operators can distinguish trial-scope readiness from full SportsDataIO NBA integration completion without making provider calls or weakening production gates. The change is reporting-only and makes no provider calls, Supabase mutations, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, SportsDataIO NBA readiness documentation.

## 2026-07-13 - Surface SportsDataIO NBA Completion Evidence Matrix In Runtime Observability

Context: SportsDataIO NBA Integration Readiness V1 now returns `completionEvidenceMatrix`, but Runtime Observability V1 only surfaced the historical import handoff view of proof gaps and completion blockers.

Decision: Extend `/api/observability/runtime` and `RuntimeObservabilityPanel` to include a compact zero-call completion evidence matrix summary and top completion-blocking unresolved evidence. Keep the expected proof-gap state informational so unresolved external blockers remain visible without enabling live execution.

Consequences: Operators can see proof gaps and full-goal blockers from the general runtime panel as well as the historical import handoff panel. The change is reporting-only and makes no provider calls, Supabase mutations, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: Runtime Observability V1, SportsDataIO NBA Observability Integration V1, SportsDataIO NBA Integration Readiness V1, Runtime Observability Panel.

## 2026-07-13 - Add SportsDataIO NBA Surface Consistency Audit

Context: The readiness API, historical import handoff panel and runtime observability panel now expose blocker, gate and completion-evidence signals, but there was no single local audit proving those reporting surfaces were aligned.

Decision: Add `surfaceConsistencyAudit` to SportsDataIO NBA Integration Readiness V1 and display it in `HistoricalImportEnginePanel`, `/api/observability/runtime` and `RuntimeObservabilityPanel`. The audit declares the expected readiness, historical import and runtime observability surfaces and validates zero-call generation, core audit validity, completion proof gaps, blocker/checklist parity and closed production gates.

Consequences: Operators get one zero-call surface-alignment check before future approvals or pilots. The audit is reporting-only and makes no provider calls, Supabase mutations, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, Runtime Observability V1, SportsDataIO NBA Observability Integration V1, Runtime Observability Panel.

## 2026-07-13 - Add SportsDataIO NBA External Approval Packet

Context: The readiness endpoint exposed blocker ledgers, approval checklists, proof gaps and surface consistency, but operators still needed one compact handoff object for future external approvals.

Decision: Add `externalApprovalPacket` to SportsDataIO NBA Integration Readiness V1 and display it in `HistoricalImportEnginePanel`, `/api/observability/runtime` and `RuntimeObservabilityPanel`. The packet packages requested approvals, approval owners, evidence requirements, capped execution constraints, prohibited actions, referenced artifacts and zero pre-approval provider-call accounting.

Consequences: Future provider, operator, database-admin or product-owner approvals have a single zero-call handoff packet. The packet is not execution approval and makes no provider calls, Supabase mutations, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, Runtime Observability V1, SportsDataIO NBA Observability Integration V1, Runtime Observability Panel.

## 2026-07-13 - Add SportsDataIO NBA Blocked-State Audit

Context: The readiness endpoint now has handoff, approval and consistency artifacts, but the active long-horizon goal still needed one explicit local audit stating that full completion cannot be claimed while external production evidence is missing.

Decision: Add `blockedStateAudit` to SportsDataIO NBA Integration Readiness V1 and surface it in `HistoricalImportEnginePanel`, `/api/observability/runtime` and `RuntimeObservabilityPanel`. The audit validates zero-call generation, external blocker presence, completion proof gaps, zero pre-approval provider calls and closed production gates, with `completionClaimAllowed=false`.

Consequences: Operators can distinguish safe local readiness/handoff from full objective completion. The audit is reporting-only and makes no provider calls, Supabase mutations, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, Runtime Observability V1, SportsDataIO NBA Observability Integration V1, Runtime Observability Panel.

## 2026-07-13 - Add SportsDataIO NBA Domain Completion Proof Ledger

Context: The readiness endpoint exposed objective-level proof gaps and blocked-state status, but operators still needed a domain-by-domain view that ties each SportsDataIO NBA domain to proof state, persistence target, linked blockers, linked objective requirements and required next evidence.

Decision: Add `domainCompletionProofLedger` to SportsDataIO NBA Integration Readiness V1 and surface it in `HistoricalImportEnginePanel`, `/api/observability/runtime` and `RuntimeObservabilityPanel`. The ledger is generated from existing handoff domains, the external blocker ledger and the completion evidence matrix. It keeps `completionClaimAllowed=false` and `providerCallsAllowedBeforeApproval=0` while external endpoint, entitlement, migration, settlement, quota and production validation evidence remains missing.

Consequences: Operators can see which domains are trial-proven, zero-call ready or externally blocked without making provider calls or reading raw payloads. The ledger does not approve live execution, run migrations, mutate Supabase, persist predictions, run backtests, train models or convert trial/scrambled rows into production evidence.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, Runtime Observability V1, SportsDataIO NBA Observability Integration V1, Runtime Observability Panel.

## 2026-07-13 - Validate SportsDataIO NBA Domain Proof Across Self-Audits

Context: The domain completion proof ledger was returned by readiness and observability surfaces, but response-shape and surface-consistency audits also needed to assert its coverage and blocker semantics so the API validates its own new proof block.

Decision: Wire `domainCompletionProofLedger` into `responseShapeAudit` and `surfaceConsistencyAudit`. Response-shape validation now requires the ledger to be valid, zero-call, handoff-domain complete, completion-blocking and zero pre-approval-call. Surface consistency now declares the ledger across readiness, historical import and runtime observability surfaces.

Consequences: Domain proof is now part of the machine-readable self-audit contract instead of being display-only. This remains zero-call and does not approve live provider execution, migrations, Supabase mutations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine Panel, SportsDataIO NBA Observability Integration V1.

## 2026-07-13 - Add SportsDataIO NBA Provider Execution Gate

Context: The readiness response exposed approval packets, blocker ledgers and production gate audits, but operators and future execution routes still needed one machine-readable go/no-go signal for whether any SportsDataIO NBA provider pilot may run now.

Decision: Add `providerExecutionGate` to SportsDataIO NBA Integration Readiness V1 and surface it in `HistoricalImportEnginePanel`, `/api/observability/runtime` and `RuntimeObservabilityPanel`. The gate is derived from the external blocker ledger, production gate audit, next-pilot approval checklist, external approval packet, blocked-state audit and domain completion proof ledger. It reports `liveExecutionAllowed=false` and `providerCallsAllowedNow=0` while external blockers remain open.

Consequences: Future provider execution can read one local gate before requesting or running a pilot. The gate is not approval and does not make provider calls, run migrations, mutate Supabase, persist predictions, run backtests, train models or convert trial/scrambled rows into production evidence.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import Engine Panel, SportsDataIO NBA Observability Integration V1, Runtime Observability Panel.

## 2026-07-13 - Enforce SportsDataIO NBA Provider Execution Gate Before Live Transport

Context: `providerExecutionGate` existed as a readiness and observability signal, but `/api/historical-import/execute` still relied on pilot-shape checks and did not consult the aggregate go/no-go gate before dispatching to live SportsDataIO pilot handlers.

Decision: Wire `providerExecutionGate` into `sportsdataio-historical-import-readiness.service.ts` non-dry-run validation for SportsDataIO NBA requests. If the gate is invalid, closed, or allows zero calls, validation returns an error before any provider transport can start.

Consequences: The live execution path now shares the aggregate readiness gate and rejects provider calls while external blockers remain open. This enforcement makes zero provider calls itself, performs no Supabase mutation and does not change dry-run planning behavior.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, SportsDataIO NBA Integration Readiness V1, `/api/historical-import/execute`.

## 2026-07-13 - Validate SportsDataIO NBA Provider Execution Gate Rejection Deterministically

Context: The historical import execution path now consults `providerExecutionGate`, but deterministic readiness validation also needed to prove a live-shaped NBA request is rejected by that gate with zero provider calls before transport.

Decision: Extend `runSportsDataIoExecutionReadinessValidation()` with a non-dry-run, confirmed, capped NBA players request that otherwise matches the players pilot shape. The validation asserts that the request is rejected, the gate reports `liveExecutionAllowed=false` and `providerCallsAllowedNow=0`, and provider-call accounting remains zero.

Consequences: The gate enforcement is covered by local deterministic validation and does not require credentials, provider calls, migrations, Supabase mutations, prediction persistence, backtesting or model training.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, SportsDataIO NBA Integration Readiness V1.

## 2026-07-13 - Validate SportsDataIO NBA Provider Execution Gate In Self-Audits

Context: `providerExecutionGate` was returned, displayed, enforced and deterministically validated, but aggregate readiness self-audits still needed to assert that the gate is part of the response contract and surface alignment.

Decision: Wire `providerExecutionGate` into `responseShapeAudit` and `surfaceConsistencyAudit`. Response-shape validation now requires the provider gate to be present, valid, zero-call, closed and allowing zero calls while external blockers remain. Surface consistency declares the provider gate across readiness, historical import and runtime observability surfaces.

Consequences: The provider execution gate is now part of the machine-readable self-audit contract. This remains local and makes no provider calls, migrations, Supabase mutations, prediction persistence, backtesting or model-training changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import Engine Panel, Runtime Observability V1, SportsDataIO NBA Observability Integration V1.

## 2026-07-13 - Use Stored Lineups In NBA Feature Preview Without Confidence Leakage

Context: SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 persisted trial/scrambled `sport_lineups` rows, and `nba-injury-lineup-confidence.service.ts` could read them, but the NBA Feature Store preview still represented lineup context as unavailable with sample size 0.

Decision: Enrich NBA Feature Store preview lineup context from stored `sport_lineups` availability, freshness, sample size and provenance. Keep trial lineup rows excluded from production confidence improvement and retain conservative penalties.

Consequences: Feature previews and observability now reflect the stored lineup/depth pilot data accurately without treating trial/scrambled records as production-grade roster context.

Affected modules: NBA Feature Store Integration V1, NBA Injury and Lineup Confidence Integration V1, SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1.

## 2026-07-13 - Add Stored Trial Isolation Audit For SportsDataIO NBA

Context: SportsDataIO NBA trial rows now span teams, events, standings, game stats, injuries, players, lineups and provider mappings. Per-pilot checks existed, but there was no current-state audit that scanned normalized tables plus `prediction_history` for production leakage.

Decision: Add SportsDataIO NBA Trial Isolation Audit V1 as a read-only Supabase validation endpoint. Scan stored SportsDataIO NBA rows for trial/scrambled metadata, `production_eligible=false`, and prediction-history references to trial events or trial markers.

Consequences: Trial-isolation verification is now available as an operational audit without provider calls or mutations. Any violation is reported explicitly rather than repaired automatically.

Affected modules: SportsDataIO NBA Trial Isolation Audit V1, SportsDataIO NBA Integration Readiness V1, NBA Prediction Engine V1, NBA Feature Store Integration V1.

## 2026-07-13 - Surface SportsDataIO NBA Readiness In Runtime Observability

Context: SportsDataIO NBA readiness, trial-isolation and pilot safety checks were available through dedicated routes, but the general runtime observability endpoint did not summarize that provider-specific operational state.

Decision: Extend Runtime Observability V1 with a nested `sportsDataIoNba` block that composes SportsDataIO NBA Integration Readiness V1 and Trial Isolation Audit V1, then render the same block inside `RuntimeObservabilityPanel`. Keep the existing runtime response intact, perform only read-only Supabase and local readiness checks, and report provider calls as zero.

Consequences: Operators can inspect SportsDataIO NBA blockers, readiness routes, trial-isolation totals and prediction leakage counts from `/api/observability/runtime` and the dashboard without spending provider quota or adding a migration. Violations remain reported-only and do not trigger automatic remediation or production confidence changes.

Affected modules: Runtime Observability V1, SportsDataIO NBA Observability Integration V1, SportsDataIO NBA Integration Readiness V1, SportsDataIO NBA Trial Isolation Audit V1.

## 2026-07-13 - Surface SportsDataIO NBA Blocker Ledger In Runtime Observability

Context: SportsDataIO NBA Integration Readiness V1 now exposes an external blocker ledger with required evidence, owners, safe actions, zero pre-approval provider calls and closed production gates. Runtime observability still showed only aggregate readiness blocker counts.

Decision: Extend `/api/observability/runtime` and `RuntimeObservabilityPanel` to include the SportsDataIO NBA external blocker ledger summary and top safe actions from the zero-call readiness service. Keep the route read-only and avoid any new provider calls, migrations, Supabase mutations or prediction workflow changes.

Consequences: Operators can now see endpoint, entitlement, migration, settlement, quota and production-validation blockers from both the historical import handoff surface and the runtime health surface. The observability layer remains reporting-only and keeps production gates closed.

Affected modules: Runtime Observability V1, SportsDataIO NBA Observability Integration V1, SportsDataIO NBA Integration Readiness V1, Historical/Runtime dashboard panels.

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

## 2026-07-14 - Extend Existing Cron Route With NBA Daily Sync Orchestrator V2

Context: The NBA daily workflow was visible in sync status/data-health responses, but operators still needed a compatibility-preserving way to validate dependency order, checkpoint/resume metadata, provider-call budgets and read-only downstream steps without adding another status route or making provider calls.

Decision: Extend the existing `/api/cron/daily-sync` route behind `version=2` and add `runDailySyncOrchestratorV2()` in `daily-pipeline.service.ts`. The V2 response defaults to dry-run mode, enforces provider-call budget checks, uses concurrency `1`, disables automatic retries, exposes checkpoint/resume/cancel metadata and can execute only read-only Feature Store preview, prediction preview, model-health and data-quality steps when safe. Runtime validation used `dryRun=true` and `providerCallBudget=0`, returned 10 steps, made 0 provider calls, left prediction persistence disabled and kept production gates closed for trial-only or externally blocked domains.

Consequences: The existing cron surface can now prove the NBA daily workflow without provider transport or product-surface expansion. Mutating production refresh steps remain externally blocked until explicit provider, quota, endpoint/date-window and production-promotion approvals are granted.

Affected modules: Daily pipeline service, existing `/api/cron/daily-sync`, NBA Feature Store preview, NBA prediction preview, NBA model health and NBA data-quality audit.

## 2026-07-14 - Add Multi-Sport Import Planning To Existing Historical Import Plan

Context: MLB, NFL, NHL and soccer need concrete import planning before provider-backed historical imports are approved, but adding more readiness routes would duplicate the existing provider-independent historical import planner.

Decision: Extend `historical-import-engine.service.ts` and `/api/historical-import/plan` with an additive `multiSportPlanning` response section. The section returns MLB/NFL/NHL/soccer planning contracts with dependency order, destination tables, natural keys, conflict targets, request caps, checkpoint/resume strategy, trial isolation defaults, downstream handoffs and sport-specific warnings. `player_stats` is now accepted as a historical import data type. Validation against the existing plan route returned HTTP 200, four sport plans, provider calls made `0` and API route count 205.

Consequences: Future execution can advance from one canonical dry-run planning surface without guessing endpoints or expanding the API surface. Live imports remain blocked until provider, quota, exact endpoint/date-window and production-promotion approvals are explicit.

Affected modules: Historical Import Engine Core V1, `/api/historical-import/plan`, historical import documentation.

## 2026-07-14 - Stop SportsDataIO NBA Betting Odds Pilot On Unsupported BettingEvent Shape

Context: The user supplied SportsDataIO NBA betting endpoints for a capped contract pilot: `BettingEventsByDate/{date}` and `AlternateMarketGameOddsByDate/{date}`, with a typo-sensitive `LveGameOddsByDate/{date}` route explicitly excluded until spelling is verified. The pilot was allowed at most 2 sequential provider calls with no retries and trial-only persistence.

Decision: Extend the existing `/api/historical-import/execute` service path for the approved `domains=["odds"]`, `dateFrom=dateTo=2025-12-26`, `maximumRequests=2`, concurrency `1` shape. Call `BettingEventsByDate/2025-12-26` first and stop before any second endpoint if schema, normalization, mapping or persistence fails. The first endpoint reached provider transport and returned records, but the real payload normalized to zero supported `sports_odds_snapshots` rows, so the pilot stopped before `AlternateMarketGameOddsByDate/2025-12-26`. No odds rows were persisted and no migration was created.

Consequences: The current `sports_odds_snapshots` table remains safe for core outcome rows, but the real SportsDataIO `BettingEvent` graph needs a payload-shape normalization pass before another provider call. Production predictions, CLV, ROI, backtesting, calibration and model training remain disabled for trial odds. The unverified `LveGameOddsByDate` spelling remains uncalled.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, SportsDataIO NBA Odds Readiness V1, existing `/api/historical-import/execute`, `sports_odds_snapshots`.

## 2026-07-13 - Add SportsDataIO NBA External Blocker Resolution Checklist

Context: The provider execution gate, blocked-state audit and domain proof ledger now keep SportsDataIO NBA live execution closed while external endpoint, entitlement, migration, settlement, quota and real-data validation blockers remain. Future handoff still needed a machine-readable checklist that translates each blocker into required evidence and pre-execution verification without allowing provider calls.

Decision: Add `externalBlockerResolutionChecklist` to SportsDataIO NBA Integration Readiness V1 and runtime observability. The checklist maps each external blocker to owner, category, required evidence, resolution steps, pre-execution verification, forbidden actions, zero pre-resolution provider-call allowance and closed production-gate state. Response-shape and surface-consistency audits now validate that the checklist covers all blockers, remains zero-call and is exposed across readiness, historical import and runtime observability surfaces.

Consequences: Operators get a concrete resolution handoff without reopening live execution. The checklist is not approval to call SportsDataIO, apply migrations, persist predictions, run backtests or train models; it preserves `providerCallsAllowedBeforeResolution=0` until external evidence is supplied and the provider execution gate is recomputed.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import dashboard, Runtime Observability dashboard.

## 2026-07-13 - Enforce SportsDataIO NBA Resolution Checklist Before Live Transport

Context: `externalBlockerResolutionChecklist` exposed the required evidence and pre-execution verification for every open SportsDataIO NBA blocker, but the historical import execution validator only returned the aggregate provider execution gate summary during non-dry-run rejection.

Decision: Wire `externalBlockerResolutionChecklist` into `sportsdataio-historical-import-readiness.service.ts` non-dry-run validation for SportsDataIO NBA requests. If the checklist is invalid, still has blockers, allows pre-resolution provider calls or implies live execution after resolution, validation returns an error before provider transport can start. Deterministic execution readiness validation now proves a live-shaped NBA request is rejected with both provider-gate and resolution-checklist guardrail summaries and zero provider calls.

Consequences: Future operators see the concrete missing evidence directly in the execution guardrails, not only in readiness handoff surfaces. This does not approve provider calls, migrations, prediction persistence, backtesting or model training.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, SportsDataIO NBA Integration Readiness V1, `/api/historical-import/execute`.

## 2026-07-13 - Add SportsDataIO NBA Production Usage Exclusion Audit

Context: Trial SportsDataIO NBA rows are persisted only for integration validation and remain non-production data. The aggregate readiness and runtime observability surfaces needed a first-class zero-call proof that these trial rows cannot enable prediction persistence, backtesting, model training or production confidence improvement while production blockers remain.

Decision: Add `productionUsageExclusionAudit` to SportsDataIO NBA Integration Readiness V1 and Runtime Observability V1. The audit verifies zero provider calls, closed production blocker state, `production_eligible=false` trial usage, disabled prediction persistence, disabled backtesting, disabled model training and no confidence lift from trial-only rows. Surface the same status in both historical import and runtime observability dashboards, and validate it through response-shape and surface-consistency audits.

Consequences: Operators can distinguish trial persistence proof from production usage approval without consuming quota or weakening gates. The change is reporting-only and makes no provider calls, migrations, Supabase mutations, prediction persistence, backtesting or model-training changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, Runtime Observability V1, Historical Import dashboard, Runtime Observability dashboard.

## 2026-07-13 - Enforce SportsDataIO NBA Production Usage Exclusion Before Live Transport

Context: `productionUsageExclusionAudit` proved trial rows cannot enable prediction persistence, backtesting, model training or production confidence lift, but the historical import execution validator only returned provider-gate and resolution-checklist summaries during non-dry-run rejection.

Decision: Wire `productionUsageExclusionAudit` into `sportsdataio-historical-import-readiness.service.ts` non-dry-run validation and guardrail reporting for SportsDataIO NBA requests. Deterministic execution readiness validation now proves a live-shaped NBA request exposes the production-usage exclusion summary before provider transport with zero provider calls.

Consequences: Future operators get the trial-data production-exclusion proof in the same execution guardrail payload that rejects live transport. If the exclusion audit ever becomes invalid or enables prediction persistence, backtesting, model training or confidence lift for trial rows, non-dry-run validation fails before provider dispatch.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, SportsDataIO NBA Integration Readiness V1, `/api/historical-import/execute`.

## 2026-07-13 - Tighten SportsDataIO NBA Objective Audit Consistency

Context: The aggregate SportsDataIO NBA readiness handoff now carries both `objectiveAudit` and `completionEvidenceMatrix`. A status/evidence mismatch could make operators read a requirement as satisfied while its own row still named remaining work.

Decision: Extend `responseShapeAudit` to require objective-audit status semantics and completion-evidence semantics to match their unresolved-work fields. `satisfied` objective items must have no remaining work; non-satisfied items must name remaining work. `proven` completion evidence must have no unresolved evidence and cannot block completion; non-proven evidence must name unresolved evidence.

Consequences: The handoff packet is harder to misread and remains machine-checkable without provider calls or mutations. The change does not alter live execution permissions, trial isolation, prediction persistence, backtesting, model training or production confidence behavior.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import dashboard, Runtime Observability V1.

## 2026-07-13 - Expose SportsDataIO Execution Readiness Validation API

Context: `runSportsDataIoExecutionReadinessValidation()` already proved dry-run defaults, live-shape rejection, provider gate closure, resolution-checklist rejection, production-usage exclusion guardrails and one-to-many counter behavior locally. Operators had to infer those checks indirectly from code or execution planning surfaces.

Decision: Add `GET /api/providers/sportsdataio/execution-readiness/validation`, a read-only API route that returns the deterministic execution-readiness validation packet. The route calls no providers, performs no Supabase mutations and does not dispatch historical import execution.

Consequences: Execution guardrail evidence is now directly inspectable without spending quota or starting a job. This does not approve live SportsDataIO calls, migrations, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, SportsDataIO NBA Integration Readiness V1, provider API surface.

## 2026-07-13 - Surface SportsDataIO Execution Readiness Validation In Runtime Observability

Context: The execution-readiness validation API made deterministic guardrail evidence directly callable, but the main runtime observability surface still showed provider gates and resolution checklists without the consolidated execution-readiness validation packet.

Decision: Add `runSportsDataIoExecutionReadinessValidation()` output to `/api/observability/runtime` and render a compact Execution Readiness Validation card in `RuntimeObservabilityPanel`. Include pass counts, zero-call accounting, guardrail statuses, plan statuses and the one-to-many counter fixture.

Consequences: Operators can inspect execution-readiness evidence from the same runtime health panel used for SportsDataIO NBA blocker and trial-isolation state. The change makes zero provider calls, performs no mutations and does not enable live execution, predictions, backtesting, model training or production confidence changes.

Affected modules: Runtime Observability V1, SportsDataIO NBA Observability Integration V1, SportsDataIO Historical Import Execution Readiness V1, Runtime Observability dashboard.

## 2026-07-13 - Surface SportsDataIO Execution Readiness Validation In Historical Import Dashboard

Context: The zero-call execution-readiness validation API and runtime observability card exposed deterministic guardrail evidence, but the historical import operator panel still showed pilot planning and aggregate NBA readiness without the consolidated execution-readiness validation packet.

Decision: Have `HistoricalImportEnginePanel` fetch `GET /api/providers/sportsdataio/execution-readiness/validation` directly and render a compact Execution Readiness Validation card with pass counts, zero-call accounting, provider gate status, external blocker resolution status, production usage exclusion status, pre-transport live-shape rejection and the one-to-many counter fixture.

Consequences: Operators can review execution guardrail proof in the same panel used for import planning and future pilot handoff. The change makes zero provider calls from services, performs no Supabase mutations, adds no migration and does not enable live execution, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO Historical Import Execution Readiness V1, SportsDataIO NBA Integration Readiness V1, Historical Import dashboard.

## 2026-07-13 - Add Execution Readiness Validation To Surface Consistency Contract

Context: The execution-readiness validation packet is now exposed through the direct API, runtime observability and the historical import dashboard, but the aggregate SportsDataIO NBA readiness handoff did not list the companion route or require that signal in its surface-consistency audit.

Decision: Add `/api/providers/sportsdataio/execution-readiness/validation` to the aggregate NBA readiness `readinessRoutes` and extend `surfaceConsistencyAudit` so readiness, historical import and runtime observability surfaces all declare the execution-readiness validation signal.

Consequences: The handoff packet can now prove that execution-readiness validation is part of the operator surface contract without importing the execution validator into the aggregate readiness service. The change remains zero-call, performs no mutations, adds no migration and does not enable provider transport or production usage.

Affected modules: SportsDataIO NBA Integration Readiness V1, SportsDataIO Historical Import Execution Readiness V1, Historical Import dashboard, Runtime Observability V1.

## 2026-07-13 - Add SportsDataIO NBA External Approval Packet API

Context: The aggregate SportsDataIO NBA readiness response included an `externalApprovalPacket`, but operators had to retrieve the large readiness payload to hand off the approval evidence bundle.

Decision: Add `GET /api/providers/sportsdataio/nba/approval-packet`, a read-only route that returns the external approval packet with the next-pilot checklist, provider execution gate, external blocker resolution checklist, production-usage exclusion audit and blocked-state audit. Add the route to the aggregate readiness route list, surface-consistency expected signals and Historical Import dashboard packet card.

Consequences: External owners can inspect the exact approval evidence packet without running historical import execution or provider transport. The route makes zero provider calls, performs no Supabase mutations, adds no migration and does not approve live execution, prediction persistence, backtesting, model training or production confidence changes.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import dashboard, provider API surface.

## 2026-07-13 - Add SportsDataIO NBA Completion Audit API

Context: The aggregate SportsDataIO NBA readiness response included objective audit, completion evidence, domain proof and blocked-state audit data, but the long-horizon objective needed a direct zero-call surface for requirement-by-requirement completion review.

Decision: Add `GET /api/providers/sportsdataio/nba/completion-audit`, a read-only route that returns the objective audit, completion evidence matrix, domain completion proof ledger, blocked-state audit, provider execution gate and production-usage exclusion audit. Add the route to readiness routes, surface-consistency expected signals, Historical Import dashboard and Runtime Observability dashboard.

Consequences: Operators can verify why the objective is not complete without provider transport or full readiness payload inspection. The route makes zero provider calls, performs no Supabase mutations, adds no migration and does not mark the objective complete while external proof gaps remain.

Affected modules: SportsDataIO NBA Integration Readiness V1, Historical Import dashboard, Runtime Observability V1, provider API surface.

## 2026-07-13 - Validate Depth/Lineups Endpoints But Preserve Empty Persistence On Unknown Payload Shape

Context: After the `sport_lineups` migration was applied remotely and local network transport was restarted, the capped SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 was rerun with `maximumRequests=2`, `concurrencyLimit=1`, no automatic retries and a server-side request timeout. The elevated live run reached `/v3/nba/scores/json/DepthCharts` and `/v3/nba/projections/json/StartingLineupsByDate/2025-DEC-26` sequentially, and both returned HTTP 200.

Decision: Keep the import trial-isolated and do not fabricate lineup/depth rows when the trial/scrambled SportsDataIO payload does not match the current normalizer keys. Record the sync job with fetched/skipped counters, leave `sport_lineups` empty, keep production confidence blocked and require a future approved payload-shape review before another live persistence attempt.

Consequences: Endpoint access is confirmed and the `sport_lineups` upsert path is wired to the applied migration, but no lineup/depth records were inserted or updated. NBA feature preview, prediction health and prediction generation continue to report lineup context unavailable; trial injury rows still cannot improve production confidence. Future work should update normalizer key extraction before consuming additional provider quota for this domain.

Affected modules: SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1, SportsDataIO Historical Import Execution Readiness V1, NBA Injury and Lineup Confidence Integration V1, NBA Feature Store Integration V1.

## 2026-07-13 - Normalize Nested Depth/Lineup Payloads Without Exceeding Provider Cap

Context: The SportsDataIO NBA depth-chart and starting-lineup endpoints returned HTTP 200 with top-level team/game container records, but the original normalizers expected player rows directly at the top level. The approved payload-normalization run allowed only 2 external calls total.

Decision: Add provider-specific nested payload flattening, sanitized shape summaries and broader key extraction for player, team, event, position, depth order, starter/bench, lineup status, confirmation and timestamps. Preserve only sanitized shape metadata and trial-isolated normalized rows; do not store raw provider payloads. Deduplicate `sport_players`, `sport_lineups` and provider mapping upsert batches by their conflict keys before persistence.

Consequences: The code can now traverse nested team/game containers and avoids duplicate-upsert failures from repeated players. The first normalization run consumed the approved two provider calls and stopped on duplicate `sport_players` upsert input before the dedupe fix was applied, so no lineup/depth rows were persisted in that run. A later approved capped rerun verified persistence: 39 top-level provider records flattened into 758 normalized lineup/depth rows, persisted 758 `sport_lineups` rows and 758 provider mappings, and preserved production confidence isolation.

Affected modules: SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1, SportsDataIO Historical Import Execution Readiness V1, NBA Injury and Lineup Confidence Integration V1.

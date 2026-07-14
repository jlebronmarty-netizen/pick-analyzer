# Architecture

Pick Analyzer is a Next.js 16 App Router application with a service-heavy backend inside the same repository. It combines sports data synchronization, normalized multi-sport adapters, prediction generation, settlement, analytics, portfolio tools and dashboard panels.

## Next.js Structure

- `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/dashboard/page.tsx` and `src/app/model/page.tsx` define pages.
- `src/app/api/**/route.ts` contains 205 API route files.
- `src/app/dashboard/page.tsx` composes dashboard sections from `src/components/dashboard`.
- Protected operational routes commonly use `CRON_SECRET` with `Authorization: Bearer <secret>` or a `secret` query parameter.

## Services

Major service groups:

- Prediction: `prediction.service.ts`, `prediction-engine-v4.service.ts`, `prediction-history.service.ts`, `prediction-settlement.service.ts`, `nba-prediction-engine.service.ts`, `nba-prediction-validation.service.ts`, `nba-prediction-settlement.service.ts`.
- Production gating: `production-data-gate.service.ts` is the shared guard for production-eligible rows and is used by feature validation, prediction persistence, production metrics, CLV, calibration, backtesting, model learning, recommendations and portfolio-facing consumers.
- Shared prediction SDK: `sport-prediction-engine-sdk.service.ts` defines provider-independent sport engine strategy/input/output contracts, market capability declarations, deterministic probability/edge/EV/recommendation building and integration contracts for Kelly, Smart Ranking, Monte Carlo, persistence, settlement and model health.
- Shared settlement: `settlement-core.service.ts` defines generic moneyline/spread/total primitives plus deterministic multi-sport fixture coverage for common market, period, overtime, push and void contracts.
- Scoring and risk: `smart-ranking.service.ts`, `kelly.service.ts`, `risk-grade.service.ts`, `adaptive-scoring.service.ts`, `adaptive-weight-engine.service.ts`.
- Model operations: `model-learning.service.ts`, `model-calibration.service.ts`, `model-versioning.service.ts`, `model-backtest.service.ts`, `self-learning-engine.service.ts`.
- Market intelligence: `clv.service.ts`, `clv-analytics.service.ts`, `closing-line-intelligence.service.ts`, `market-intelligence.service.ts`, `market-movement.service.ts`, `sharp-money.service.ts`, `sharp-money-intelligence.service.ts`.
- Portfolio and bankroll: `portfolio-ai-v2.service.ts`, `portfolio-builder.service.ts`, `portfolio-optimizer.service.ts`, `portfolio-scoring.service.ts`, `portfolio-simulator.service.ts`, `bankroll.service.ts`, `bankroll-manager.service.ts`.
- Multi-sport: `multi-sport-registry.service.ts`, `multi-sport-providers.service.ts`, `multi-sport-adapters.service.ts`, `multi-sport-normalizers.service.ts`, `multi-sport-query.service.ts`, `multi-sport-health.service.ts`, `multi-sport-markets.service.ts`.
- Provider contracts: `provider-adapter-sdk.service.ts` defines provider-independent adapter contracts, endpoint capabilities, auth shape, pagination, rate-limit hints, retry hints and fixture validation.
- Import architecture: `historical-import-engine.service.ts` plans provider-independent historical imports, checkpoints, idempotency, dedupe keys, quota estimates and additive NBA/MLB/NFL/NHL/soccer V2 import manifests without executing provider calls.
- Feature store: `feature-store-core.service.ts` defines versioned feature definitions, computed snapshots, freshness, provenance, sample size, cutoff timestamps, invalidation keys and leakage validation.
- Historical feature generation: `historical-feature-generation.service.ts` plans dry-run and bounded write-mode leakage-safe historical pregame feature snapshots from persisted normalized records only, with deterministic IDs, lineage, trial/production gates, checkpoint contracts, durable snapshot persistence readiness and backtest input eligibility.
- Feature registry: `multi-sport-feature-registry.service.ts` maps feature definitions into sport, market and model-specific feature sets with readiness states and fallback policies.
- NBA: `nba-adapter.service.ts`, `nba-data-sync.service.ts`, `nba-prediction-engine.service.ts`, `nba-prediction-validation.service.ts`, `nba-prediction-settlement.service.ts`.
- NBA feature integration: `nba-feature-store-integration.service.ts` previews and validates NBA Feature Store-compatible snapshots, including stored injury and unavailable-lineup confidence context.
- NBA injury/lineup confidence: `nba-injury-lineup-confidence.service.ts` reads stored NBA injury rows and static provider configuration state to produce confidence penalties, data sufficiency penalties, unresolved mapping warnings, trial-data isolation flags and lineup-unavailable context without provider calls.
- MLB feature integration: `mlb-feature-store-integration.service.ts` previews and validates MLB Feature Store-compatible snapshots, existing MLB storage signals and missing sport-specific domains without changing legacy MLB prediction generation.
- MLB prediction engine: `mlb-prediction-engine.service.ts` builds deterministic moneyline, spread/run line and total previews through the Shared Sport Prediction Engine SDK without provider calls, persistence or production accuracy claims.
- NFL feature integration: `nfl-feature-store-integration.service.ts` previews and validates NFL Feature Store-compatible snapshots, existing normalized storage signals and missing sport-specific domains without changing prediction generation.
- NFL prediction engine: `nfl-prediction-engine.service.ts` builds deterministic moneyline, spread, total and first-half previews through the Shared Sport Prediction Engine SDK without provider calls, persistence or production accuracy claims.
- Soccer feature integration: `soccer-feature-store-integration.service.ts` previews and validates soccer Feature Store-compatible snapshots, existing normalized storage signals and missing sport-specific domains without changing prediction generation.
- Soccer prediction engine: `soccer-prediction-engine.service.ts` builds deterministic 1X2, double chance, draw no bet, totals, BTTS, first-half, qualification and Asian handicap contract previews with three-way probability normalization and zero provider calls.
- NHL feature integration: `nhl-feature-store-integration.service.ts` previews and validates NHL Feature Store-compatible snapshots, existing normalized storage signals and missing goalie, injury, rest and special-teams domains without changing prediction generation.
- NHL prediction engine: `nhl-prediction-engine.service.ts` builds deterministic moneyline, puck line/spread and total previews through the Shared Sport Prediction Engine SDK without provider calls, persistence or production accuracy claims.
- Tennis feature integration: `tennis-feature-store-integration.service.ts` previews and validates tennis Feature Store-compatible snapshots, existing normalized storage signals and missing player-form, surface, ranking and injury domains without changing prediction generation.
- Tennis prediction engine: `tennis-prediction-engine.service.ts` builds deterministic match-winner and match-total previews through the Shared Sport Prediction Engine SDK without provider calls, persistence or production accuracy claims.
- UFC feature integration: `ufc-feature-store-integration.service.ts` previews and validates UFC Feature Store-compatible snapshots, existing normalized storage signals and missing fighter-form, camp, injury, method and weigh-in domains without changing prediction generation.
- UFC prediction engine: `ufc-prediction-engine.service.ts` builds deterministic fight-winner and method-contract previews through the Shared Sport Prediction Engine SDK without provider calls, persistence or production accuracy claims.
- AI surfaces: `ai-coach.service.ts`, `ai-copilot.service.ts`, `ai-copilot-chat.service.ts`, `ai-sports-brain.service.ts`, `ai-trading-advisor.service.ts`, `daily-report.service.ts`.

## API Routes

The API surface includes:

- Core predictions: `/api/predictions/*`, `/api/prediction-engine/v4`.
- NBA: `/api/nba/sync/*`, `/api/nba/predictions/*`, `/api/nba/data-health`, `/api/nba/adapter/status`.
- NBA features: `/api/nba/features/store`, `/api/nba/features/preview`, `/api/nba/features/validation`.
- MLB features: `/api/mlb/features/store`, `/api/mlb/features/preview`, `/api/mlb/features/validation`.
- MLB predictions: `/api/mlb/predictions`, `/api/mlb/predictions/health`, `/api/mlb/predictions/validation`.
- NFL features: `/api/nfl/features/store`, `/api/nfl/features/preview`, `/api/nfl/features/validation`.
- NFL predictions: `/api/nfl/predictions`, `/api/nfl/predictions/health`, `/api/nfl/predictions/validation`.
- Soccer features: `/api/soccer/features/store`, `/api/soccer/features/preview`, `/api/soccer/features/validation`.
- Soccer predictions: `/api/soccer/predictions`, `/api/soccer/predictions/health`, `/api/soccer/predictions/validation`.
- NHL features: `/api/nhl/features/store`, `/api/nhl/features/preview`, `/api/nhl/features/validation`.
- NHL predictions: `/api/nhl/predictions`, `/api/nhl/predictions/health`, `/api/nhl/predictions/validation`.
- Tennis features: `/api/tennis/features/store`, `/api/tennis/features/preview`, `/api/tennis/features/validation`.
- Tennis predictions: `/api/tennis/predictions`, `/api/tennis/predictions/health`, `/api/tennis/predictions/validation`.
- UFC features: `/api/ufc/features/store`, `/api/ufc/features/preview`, `/api/ufc/features/validation`.
- UFC predictions: `/api/ufc/predictions`, `/api/ufc/predictions/health`, `/api/ufc/predictions/validation`.
- Multi-sport: `/api/sports`, `/api/sports/health`, `/api/sports/[sport]/*`.
- Provider SDK: `/api/providers/sdk`, `/api/providers/sdk/validation`.
- SportsDataIO contract: `/api/providers/sportsdataio/contract`, `/api/providers/sportsdataio/validation`.
- SportsDataIO execution readiness: `/api/providers/sportsdataio/status`, `/api/providers/sportsdataio/capabilities`, `/api/providers/sportsdataio/execution-readiness/validation`, `/api/providers/sportsdataio/nba/readiness`, `/api/providers/sportsdataio/nba/provider-gate`, `/api/providers/sportsdataio/nba/external-blockers`, `/api/providers/sportsdataio/nba/blocker-resolution`, `/api/providers/sportsdataio/nba/production-gate`, `/api/providers/sportsdataio/nba/production-usage-exclusion`, `/api/providers/sportsdataio/nba/domain-proof`, `/api/providers/sportsdataio/nba/completion-evidence`, `/api/providers/sportsdataio/nba/objective-audit`, `/api/providers/sportsdataio/nba/safe-next-actions`, `/api/providers/sportsdataio/nba/evidence-export`, `/api/providers/sportsdataio/nba/next-pilot-preflight`, `/api/providers/sportsdataio/nba/approval-packet`, `/api/providers/sportsdataio/nba/completion-audit`, `/api/providers/sportsdataio/nba/contract-audit`, `/api/providers/sportsdataio/nba/odds/readiness`, `/api/providers/sportsdataio/nba/odds/endpoint-preflight`, `/api/providers/sportsdataio/nba/player-props/readiness`, `/api/providers/sportsdataio/nba/player-props/endpoint-preflight`, `/api/providers/sportsdataio/nba/player-stats/readiness`, `/api/providers/sportsdataio/nba/player-stats/migration-preflight`, `/api/providers/sportsdataio/nba/trial-isolation`, `/api/historical-import/execute`, `/api/historical-import/resume`, `/api/historical-import/cancel`, `/api/historical-import/jobs/[jobId]`, `/api/historical-import/pilot-plan`, `/api/historical-import/validate/[jobId]`. For NBA readiness, `/api/providers/sportsdataio/nba/readiness` is canonical; domain-proof, completion-evidence, objective-audit and safe-next-actions preserve compatibility contracts as aliases, and optional preflight routes remain operational aliases for focused approval checks.
- Historical import planning: `/api/historical-import/plan`, `/api/historical-import/health`, `/api/historical-import/jobs`. The plan route is canonical for dry-run multi-sport import planning and includes additive `multiSportPlanning` sections for MLB, NFL, NHL and soccer.
- Feature store: `/api/features/store`, `/api/features/store/definitions`, `/api/features/store/validation`.
- Feature registry: `/api/features/registry`, `/api/features/registry/lookup`, `/api/features/registry/validation`.
- Shared sport prediction SDK: `/api/prediction-sdk`, `/api/prediction-sdk/validation`.
- Analytics and model operations: `/api/analytics/*`, `/api/model/*`.
- Portfolio, bankroll, parlay and simulator routes.
- Cron routes under `/api/cron/*`.

When adding routes, keep response shapes typed, preserve existing contracts and use service-layer logic rather than duplicating business logic in route handlers.

## Supabase Usage

- `src/lib/supabase.ts` creates the public Supabase client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `src/lib/supabase-admin.ts` creates the service-role client using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `src/lib/server-schema-capabilities.ts` performs server-only schema capability probes using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; it returns table/column readiness statuses without exposing URLs, keys or row values.
- Services use Supabase for `prediction_history`, `team_stats`, `game_results`, NBA sync tables and model/analytics persistence.
- Migrations live under `supabase/migrations` and should be additive.

## Sports Adapters

The Multi-Sport Engine registers sports in `src/config/sports.config.ts` and leagues in `src/services/multi-sport-registry.service.ts`. Current registered sports include MLB, NBA, NFL, NHL, soccer, tennis, UFC and BSN.

Adapters and providers normalize external data into the shared types from `src/types/multi-sport.ts`. Unsupported provider capabilities should return warnings or empty typed results.

## Providers

Provider metadata lives in `src/services/multi-sport-providers.service.ts`.

Current provider patterns:

- The Odds API: odds, events and scores for supported sports.
- API-Sports: present for selected integrations such as MLB team stats.
- Supabase-backed local data: BSN and project-owned persistence.

Provider keys are read from environment variables and must never be documented or committed.

Provider Adapter SDK V1 defines the contract for future concrete providers. New provider adapters should declare capabilities, authentication, pagination, retry hints and normalization into shared models before any live provider execution is enabled.

SportsDataIO Adapter Contract V1 is contract-only. It documents endpoint mappings, placeholder environment variable names and local fixture validation, but does not activate credentials or live provider requests.

SportsDataIO MLB Discovery Lab is modeled as a separate provider variant from SportsDataIO enterprise. The Discovery Lab MLB route family is `https://api.sportsdata.io/api/mlb/{product}/json/{endpoint}` with product channels such as `fantasy` and `odds`, authenticated server-side with `SPORTSDATAIO_MLB_API_KEY` through the `Ocp-Apim-Subscription-Key` header. Enterprise `/v3/mlb/...` endpoints remain cataloged as enterprise-only and are not automatically executable with the Discovery Lab key.

## Normalized Models

`src/types/multi-sport.ts` defines normalized:

- sports and leagues
- teams and participants
- venues and events
- markets and odds snapshots
- injuries, lineups and players
- predictions and model output
- provider health and adapter results

New modules should extend these types only when a generic concept is missing.

## Prediction Pipeline

The existing prediction stack uses:

1. Provider/sync data.
2. Team stats, odds and event context.
3. Prediction Engine V4 and sport-specific feature builders.
4. Smart ranking, Kelly, risk grade, adaptive scoring and model learning.
5. `prediction_history` persistence.
6. Dashboard and analytics consumption.

NBA Prediction Engine V1 adds NBA-specific feature engineering and orchestration while reusing shared scoring and staking services.

NBA Feature Store Integration V1 is read-only. It validates NBA compatibility with Feature Store Core and uses existing `prediction_history.feature_snapshot` as the current persistence surface. NBA Injury and Lineup Confidence Integration V1 enriches optional `injury_context` and `lineup_context` with stored injury availability, stale-feed penalties, unresolved mapping warnings, trial-data exclusion flags and explicit lineup-unavailable status. NBA Player Stats Feature Quality Integration V1 adds optional `player_stats_context` sourced from `sport_player_stats`, including season/game row coverage, unresolved mapping counts, trial flags and production-confidence eligibility without changing prediction generation.

NBA Prediction Engine V1 consumes the injury/lineup confidence status conservatively. Trial/scrambled injuries and lineups can validate architecture but cannot improve production confidence. Missing or stale injury data is not interpreted as a healthy roster. Trial-only expected lineups remain excluded from production confidence improvement and production prediction persistence.

Shared Sport Prediction Engine SDK V1 is the provider-independent contract for new sport engines. It consumes normalized event/participant/odds data and Feature Store snapshots, computes deterministic prediction terms, reuses Kelly and Smart Ranking services, declares Monte Carlo/persistence/settlement integration contracts, and labels each sport engine as architecture-complete, deterministic-validation-complete, real-data-validation-pending and historical-calibration-pending until actual historical validation exists.

MLB Feature Store Integration V1 is read-only and partial by design. It validates core MLB moneyline feature compatibility while keeping probable pitcher, lineup, weather, park-factor and advanced-stat data as explicit unavailable domains until normalized sources are approved.

MLB Prediction Engine V1 is architecture-only and deterministic-validation-complete. It uses the Shared Sport Prediction Engine SDK for probability, fair odds, edge, EV, Kelly and Smart Ranking contracts, but it does not persist picks or create production recommendations until real MLB data validation and historical calibration exist.

NFL Feature Store Integration V1 is read-only and partial by design. It validates core NFL spread feature compatibility while keeping quarterback impact, injury impact, weather and rest/travel context as explicit unavailable domains until normalized sources are approved.

NFL Prediction Engine V1 is architecture-only and deterministic-validation-complete. It uses the Shared Sport Prediction Engine SDK for probability, fair odds, edge, EV, Kelly and Smart Ranking contracts, but it does not persist picks or create production recommendations until real NFL data validation and historical calibration exist.

Soccer Feature Store Integration V1 is read-only and partial by design. It validates core soccer moneyline feature compatibility while keeping draw-aware context, league strength, confirmed lineups and injury context as explicit unavailable domains until normalized sources are approved.

Soccer Prediction Engine V1 is architecture-only and deterministic-validation-complete. It adds soccer-specific three-way probability normalization, no-vig handling, double chance, draw no bet, BTTS and first-half contracts while keeping missing draw-aware, league, lineup, injury and expected-goals context as explicit warnings.

NHL Feature Store Integration V1 is read-only and partial by design. It validates core NHL moneyline feature compatibility while keeping starting goalie, goalie form, injury impact, special-teams and rest/travel context as explicit unavailable domains until normalized sources are approved.

NHL Prediction Engine V1 is architecture-only and deterministic-validation-complete. It uses the Shared Sport Prediction Engine SDK for probability, fair odds, edge, EV, Kelly and Smart Ranking contracts, but it does not persist picks or create production recommendations until real NHL data validation and historical calibration exist.

Tennis Feature Store Integration V1 is read-only and partial by design. It validates core tennis moneyline feature compatibility while keeping player form, surface, ranking and injury context as explicit unavailable domains until normalized sources are approved.

Tennis Prediction Engine V1 is architecture-only and deterministic-validation-complete. It uses the Shared Sport Prediction Engine SDK for probability, fair odds, edge, EV, Kelly and Smart Ranking contracts, but it does not persist picks or create production recommendations until real tennis data validation and historical calibration exist.

UFC Feature Store Integration V1 is read-only and partial by design. It validates core UFC moneyline feature compatibility while keeping fighter form, camp, injury, method and weigh-in context as explicit unavailable domains until normalized sources are approved.

UFC Prediction Engine V1 is architecture-only and deterministic-validation-complete. It uses the Shared Sport Prediction Engine SDK for probability, fair odds, edge, EV, Kelly and Smart Ranking contracts. Moneyline markets remain settlement-compatible, while method contracts are explicitly contract-only until combat settlement rules are implemented.

## Feature Store

Feature Store Core V1 defines computed, provider-independent feature snapshots. A snapshot includes feature definition versions, provenance, freshness, sample size, quality, sufficiency, cutoff timestamps and invalidation keys. Historical Feature Generation Orchestrator V1 builds on this contract for dry-run historical pregame snapshots with deterministic snapshot IDs, model/feature-set version identity, lineage metadata, trial/scrambled/production flags, checkpoint/resume/cancel policy and deterministic leakage/persistence fixtures. Cutoff equality is inclusive, post-cutoff records are rejected, final outcomes/postgame stats/settlement/performance rows are never pregame features and missing source timestamps are unsafe/unavailable.

Historical Feature Snapshot Persistence V1 adds generic migration `202607140001_historical_feature_snapshots_v1.sql`. It creates `historical_feature_snapshots` for immutable prediction-time feature snapshots and adds `prediction_history.feature_snapshot_id`, `feature_snapshot_key`, `feature_set_version`, `feature_snapshot_generated_at`, `production_eligible`, `trial` and `scrambled` linkage columns. Existing services use the server schema capability probe to distinguish migration-file presence from remote application. `/api/features/store` exposes the existing-route write pilot action `historical_feature_snapshot_write_pilot`, which inserts missing deterministic trial snapshots, reuses identical existing rows and refuses changed-lineage overwrites. The same route exposes bounded action `historical_prediction_snapshot_lineage_pilot`, which links capped trial predictions only when a snapshot has valid lineage and a genuine offered price. NBA Trial Validation Batch V1 used those existing actions with cap 50, inserted 27 market-specific trial snapshots, inserted 22 new predictions while reusing 5 existing predictions, settled 27 linked trial predictions and reused all rows idempotently on rerun. Production recommendations, ROI, CLV, calibration and model promotion remain blocked because the rows are trial/scrambled/non-production and lack genuine closing snapshots. Inline `prediction_history.feature_snapshot` remains legacy context, not the canonical durable lineage store. Optional stored-context definitions include injury, lineup and player stats where normalized tables exist.

## Historical Import Pipeline

Historical Import Engine Core V1/V2 sits between provider adapters and persistence. It is currently dry-run only and uses normalized sport, league and data-type concepts to plan date-range or season checkpoints. The existing `/api/historical-import/plan` response now includes `historical_import_multi_sport_planning_v2` for NBA, MLB, NFL, NHL and Soccer, with per-domain dependency graphs, season/date/week/competition scope metadata, current/recent/archive/unsupported/entitlement/migration/trial/pilot-validated readiness classifications, provider-call and record budgets, stable ID components, one-to-many expansion flags, trial-isolation defaults and validation/Feature Store/settlement/backtesting handoffs. Domain manifests use per-domain persistence contracts instead of rotating generic natural keys. It also exposes `featureGenerationHandoff` and a dry-run `historicalFeatureSnapshotWritePilot` summary from Historical Feature Generation Orchestrator V1, including required source domains, prediction cutoff strategy, estimated snapshot counts, batch/checkpoint strategy, durable snapshot persistence status, write-mode availability, migration filename, leakage validation readiness and backtest handoff readiness. It reuses Provider Intelligence V1 for capability routing and Sync Reliability Framework V1 for retry, cursor and idempotency contracts. Future provider-backed execution must write normalized records and must not expose provider-specific payload fields to sport prediction engines.

## Settlement Pipeline

General settlement exists in `prediction-settlement.service.ts` and `prediction-history.service.ts`.

Settlement Core V2 provides shared moneyline, spread and total primitives plus deterministic fixture coverage for NBA, MLB, NFL, NHL and Soccer. It treats unsupported or metadata-dependent markets such as soccer double chance, two-leg aggregate, extra-time/penalty handling and props as contract-only until result-type and grading feeds are proven.

NBA-specific settlement exists in `nba-prediction-settlement.service.ts`:

- full-game final scores come from `sport_events`
- first-half scores come from `sport_events.period_scores` or `sport_game_stats.quarter_scores`
- cancelled events void
- incomplete events remain pending
- manual adjustments and final results are not overwritten

## Dashboards

Dashboard panels are in `src/components/dashboard`. `src/app/dashboard/page.tsx` composes sections for overview, multi-sport coverage, NBA adapter/data/predictions, sports brain, daily report, prediction engine, top picks, optimizer, risk, market intelligence, live betting, portfolio, AI coach, learning and model center.

New dashboard modules should use existing panel conventions and call API routes rather than embedding persistence logic in client components.

## Cron Architecture

Cron and operational routes use `CRON_SECRET` authorization. Current cron surfaces include capture predictions, daily sync, master sync and several protected recalculation/sync endpoints.

`vercel.json` may schedule recurring jobs. Any new scheduled job must be idempotent and safe to rerun.

NBA Daily Sync Orchestration Contract V1 is exposed through existing NBA sync status/data-health surfaces rather than a new route. It declares the ordered daily workflow for schedules, results, injuries, lineups, team stats, player stats, Feature Store preview, prediction preview, settlement and data-quality audit. Each step includes route, method, protected/mutating flags, checkpoint, idempotency key, provider-call default, concurrency assumption and production safety gate. Production injury, lineup and player-stat refresh steps remain externally blocked while trial rows stay excluded from production confidence.

## Security Patterns

- Protected POST routes use `CRON_SECRET`.
- Service-role Supabase access stays server-side.
- Public clients use publishable keys only.
- Docs and code must not contain real secrets.
- Admin-like dashboard actions should not expose secrets to browser code.

## Migration Conventions

- Use deterministic table and index names.
- Prefer `create table if not exists`, `alter table ... add column if not exists`, guarded constraints and idempotent grants.
- Keep destructive changes out of autonomous work unless explicitly approved.
- Add grants for service-role and appropriate read-only roles when new tables are used by API routes.

## Extension Guidelines

### New Sports

Add the sport to `src/config/sports.config.ts`, register leagues in `multi-sport-registry.service.ts`, add markets if needed, implement or reuse an adapter and expose routes through `/api/sports/[sport]/*`.

### New Providers

Register provider metadata, implement the Provider Adapter SDK contract, normalize into shared types and add health checks. Respect quotas with incremental fetches. Fixture and dry-run validation must pass before live execution is enabled.

### New Markets

Add market definitions to `multi-sport-markets.service.ts`, update sport supported markets, then extend prediction, validation and settlement only where the market is truly supported.

### New Sync Jobs

Add service-layer orchestration, job observability, idempotent persistence and protected API routes. Never fabricate unsupported provider domains.

### Historical Imports

Start with dry-run plans from `historical-import-engine.service.ts`. SportsDataIO execution readiness is isolated in `sportsdataio-runtime-adapter.service.ts` and `sportsdataio-historical-import-readiness.service.ts`; it validates guardrails, pilot plans, domain contracts, resume/cancel shapes and post-import validation contracts. Live execution is only allowed for narrow capped pilot shapes with explicit approval. SportsDataIO NBA Pilot Import V1 confirmed `Teams` and `GamesByDate/2025-DEC-25`, used 2 external calls, persisted trial/scrambled teams metadata, provider mappings, events, scores and sync-job metadata, and marked pilot records as `production_eligible=false`. SportsDataIO NBA Pilot Import V2 confirmed `GamesByDate/2025-DEC-26`, `Standings/2026`, `TeamSeasonStats/2026` and `TeamGameStatsByDate/2025-DEC-26`; it persisted trial-isolated events, standings, team season stats and game stats under stable upsert keys. SportsDataIO NBA Players Pilot V1 confirmed `Players`, persisted 579 trial-isolated `sport_players` rows plus 579 player provider mappings, and treats those rows as roster identity/import-path validation only. Integer-only columns must receive integer values; decimal provider metrics should remain in JSON metadata or explicitly typed numeric columns. Large provider-ID preflight reads should be chunked before Supabase upserts. One-to-many provider payload expansion must report top-level provider records separately from normalized rows; `sports_sync_jobs.records_skipped` remains backward-compatible and nonnegative, while richer skipped-provider/skipped-normalized counters belong in response counters and job metadata. The legacy `team_stats` table stores NBA season by start year (`2025` for the 2025-26 season), while normalized NBA sync tables use the provider season key (`2026`). Trial events and trial roster rows are excluded from production prediction generation, validation, calibration and backtesting. Broader historical reconciliation remains blocked until explicit quota and date-window approval. Imports should be checkpointed, resumable, idempotent and mapped through `provider_entity_mappings` before writing normalized tables.

SportsDataIO NBA Injuries Pilot V1 is complete for the approved trial scope. The confirmed endpoint is `/v3/nba/projections/json/InjuredPlayers`; the pilot persisted trial-isolated `sport_injuries` rows and injury provider mappings while preserving unresolved players and teams as warnings. The earlier `/v3/nba/scores/json/Injuries` probe returned HTTP 404 and should remain historical evidence only. Trial injuries must not feed production confidence, real ROI, calibration, model training or betting recommendations.

NBA Injury and Lineup Confidence Integration V1 is the provider-independent consumer layer for those stored injury rows. It routes injury availability into Feature Store previews, NBA prediction feature quality, data sufficiency, risk warnings, explanations, Prediction Safety Framework warnings, Model Health V2 checks and dashboard observability. It does not call SportsDataIO, infer missing lineups, persist production picks or treat trial records as production-eligible.

SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 has a guarded execution path for `/v3/nba/scores/json/DepthCharts` and `/v3/nba/projections/json/StartingLineupsByDate/2025-DEC-26`. Normalized depth-chart and lineup relationship rows use `sport_lineups`, introduced by the non-destructive migration `supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql` and applied remotely. Trial lineup/depth rows must be marked `trial=true`, `scrambled=true` and `production_eligible=false`; they may validate architecture but must not improve production confidence, feed backtesting, feed calibration, train models or persist production recommendations. Payload Normalization V1 adds sanitized shape summaries, nested player-row flattening, home/away lineup context, position-group context and duplicate upsert-batch prevention. The pilot is complete for the approved trial scope, and Reporting Counter Fix V1 confirms that 39 provider records expanding to 758 normalized rows reports `recordsSkipped=0` for future runs.

SportsDataIO NBA Player Stats Readiness V1 introduces the normalized `sport_player_stats` table through additive migration `supabase/migrations/202607130002_sport_player_stats_v1.sql`, now applied remotely. It separates roster identity (`players`) from statistical production (`player_stats`) in the Provider SDK and SportsDataIO contracts. Confirmed capped-trial endpoints are `/v3/nba/stats/json/PlayerSeasonStats/{season}` and `/v3/nba/stats/json/PlayerGameStatsByDate/{date}`. SportsDataIO NBA Player Stats Pilot V1 used those paths for season `2026` and date `2025-12-26`, persisted 918 trial-isolated player-stat rows plus 918 provider mappings, and kept trial rows excluded from production predictions, backtesting, calibration, model training and confidence improvement.

NBA Data Quality Player Stats Expansion V1 extends `nba-data-quality.service.ts` without provider calls. It audits `sport_players` coverage and identity duplication, optionally audits `sport_player_stats` natural keys, event/team/player references, season alignment and trial `production_eligible=false` isolation, and treats a missing `sport_player_stats` table as an informational readiness issue so existing quality routes remain available before the migration is applied. NBA Player Stats Feature Quality Integration V1 further expands the same existing data-quality routes to cover stored injuries and lineups for unresolved player/team/event links, contradictory injury statuses, stale feeds, duplicate lineup natural keys, invalid depth order and trial/production contamination.

SportsDataIO NBA Trial Isolation Audit V1 treats `sport_game_stats` trial metadata as stored in the `stats` JSON column because the deployed `sport_game_stats` table does not have a `metadata` column. This keeps post-pilot trial-isolation validation compatible with the applied schema while preserving zero-provider-call behavior.

SportsDataIO NBA Player Props Readiness V1 adds contract-only `player_props` coverage to the Provider SDK, SportsDataIO adapter contract, runtime capability metadata and historical import dry-run planning. The readiness API normalizes a local deterministic over/under fixture into future `sports_odds_snapshots`-style rows with player/event/team metadata and returns endpoint/settlement preflight gates, but it creates no migration, makes no provider calls, enables no settlement and keeps prop rows out of production prediction, backtesting and model training paths until exact markets and entitlement are approved.

SportsDataIO NBA Odds Readiness V1 adds a zero-provider-call readiness API for odds and historical odds. It validates deterministic moneyline, spread and total outcome rows against the existing `sports_odds_snapshots` persistence shape, records exact endpoint/entitlement/historical-window blockers, returns endpoint/entitlement preflight gates and keeps trial odds unable to drive production prediction, CLV, backtesting or model training until a capped live pilot is explicitly approved.

SportsDataIO NBA Betting Events and Odds Contract Pilot V1 is wired through the existing `/api/historical-import/execute` route for the approved `domains=["odds"]` shape only. It allows `BettingEventsByDate/2025-12-26` followed only by one `BettingMarkets/{eventId}` call when the first payload proves market detail is required. The verified run used 2 provider calls: `BettingEventsByDate/2025-12-26` returned 9 discovery records with nested `BettingMarkets`, and `BettingMarkets/22888` returned 0 records. The executor completed the job as discovery-only, persisted no unsupported `sports_odds_snapshots` rows, created no migration, and kept production predictions, CLV, ROI, backtesting, calibration and model training disabled. The supplied `LveGameOddsByDate` path and broad alternate-market endpoint remain intentionally uncalled until exact need and spelling are verified.

SportsDataIO NBA Priced Game Odds Pilot V1 uses the same existing `/api/historical-import/execute` route and the confirmed priced source `/v3/nba/odds/json/GameOddsByDate/{date}`. The 2026-07-14 run selected provider date `2025-12-26` because existing trial feature snapshots map to SportsDataIO games whose provider day is `2025-12-26`. The endpoint returned HTTP 200 with 9 game records and persisted trial/non-production odds rows. The approved cleanup deleted only 936 `AlternateMarketPregameOdds` rows after verifying no ambiguity and no feature-snapshot or prediction references. The approved corrected one-call retry inserted 180 null-line moneyline replacements, updated 360 spread/total rows and completed sync job `ed7ede3c-38c9-4f4f-b56b-446c43b8deb6`. The approved supersession cleanup then deleted exactly 180 legacy non-null-line moneylines after replacement verification. Final stored SportsDataIO trial odds are 540 rows split evenly across moneyline, spread and total, with 0 legacy moneylines, 0 duplicate logical rows and 0 production leakage. Trial odds rows still cannot drive production recommendations, CLV, ROI, calibration, model training or confidence improvement.

SportsDataIO Canonical Endpoint Catalog V1 lives in `src/config/sportsdataio-endpoint-catalog.ts` with concise docs under `docs/providers/sportsdataio/`. It records exact path templates, API versions, domains, parameter formats, trial/entitlement/implementation/normalization/persistence status and last pilot status for NBA, MLB, NFL, NHL and Soccer without adding routes or making provider calls.

SportsDataIO MLB Discovery Lab Variant Correction V1 records the confirmed Discovery Lab Fantasy + Odds MLB endpoint family separately from enterprise `/v3/mlb/...`. The historical import planner reports `sportsdataio_discovery_lab`, the `/api/mlb/{product}/json/{endpoint}` route family and blocked MLB domain manifests until normalizers and quarantined persistence pass. Future Discovery Lab rows start quarantined with `trial=false`, `scrambled=false`, `production_eligible=false` and no production prediction, backtesting, calibration or model-training eligibility. MLB Batch V1 now has quarantined `2026-07-12` teams, players, events and game/player stats after the shared safe preflight helper fixed oversized `.in()` chunks. The MLB odds-only retry normalizes `GameId`/`GameID` aliases and nested `PregameOdds`, ignores alternate/live arrays, and persisted 90 quarantined full-game `sports_odds_snapshots` rows from `GameOddsByDate/2026-07-12`. No feature snapshots, predictions, settlement, backtesting or production promotion are enabled because 0 odds rows were timestamp-safe relative to stored event starts.

SportsDataIO MLB Line Movement Probe V1 extends the same MLB normalization service for `GameOddsLineMovement/{gameid}` without adding routes, dashboards or tables. Line-movement rows use source-aware deterministic IDs under `sportsdataio:line_movement`, include provider timestamps in `snapshot_time` and metadata, do not infer opening or closing labels from array position, and keep `trial=false`, `scrambled=false`, `production_eligible=false` plus quarantine metadata. The one-game probe for GameId `78723` persisted 3,720 quarantined odds rows and proved timestamp-safe pregame movement exists. The existing Feature Store route actions now have an MLB-bounded branch that maps provider `run_line` rows into the shared `spread` contract while preserving `providerMarket=run_line` in lineage metadata, selects cutoff-safe persisted odds only, persists quarantined non-production feature snapshots, links predictions through `prediction_history.feature_snapshot_id`, and settles only those linked one-game rows through Settlement Core. No production prediction, Kelly/bankroll/portfolio action, model promotion or CLV metric is enabled by this technical validation.

SportsDataIO Betting Market Normalization Core V1 lives in `src/services/sportsdataio-betting-normalizer.service.ts`. It is provider-independent and shared across future NBA, MLB, NFL, NHL and Soccer odds work. It separates betting event, game, market, outcome and sportsbook identifiers; classifies discovery, market-index, priced-outcome, archive-required, entitlement-blocked, empty and unsupported payloads; normalizes only actual priced outcomes; preserves unresolved identifiers; derives decimal odds and implied probability only from valid American prices; and routes older events to an archive-required state without inventing Historical API paths. Existing `/api/historical-import/execute` and runtime validation surfaces consume this logic without adding routes.

SportsDataIO NBA Integration Readiness V1 is the aggregate zero-call readiness surface. It composes runtime adapter validation, capability metadata, odds readiness, player prop readiness and player stat readiness into one status/blocker/safety-invariant API for handoff and observability. It also returns a domain handoff matrix for trial-complete areas, blocked production domains, production gates, safe next actions, objective completion audit, external blocker ledger, validated readiness evidence export, production gate audit, provider execution gate, external blocker resolution checklist and route, production usage exclusion audit and route, next-pilot approval checklist, external approval packet, blocked-state audit, domain completion proof ledger, completion evidence matrix, response-shape audit, surface consistency audit and next-pilot preflight summaries. `HistoricalImportEnginePanel` now renders a canonical Readiness Summary from `/api/providers/sportsdataio/nba/readiness` and uses those embedded preflight summaries instead of fetching odds, player-props and player-stats readiness separately. Focused proof/evidence/audit/action routes are compatibility aliases over sections of the canonical response; focused preflight routes remain operational aliases for approval workflows. It does not call Supabase or SportsDataIO and does not mark the integration production-ready while external endpoint, entitlement, migration, settlement, quota and real-data validation blockers remain.

NBA Stored Lineup Feature Enrichment V1 connects persisted `sport_lineups` rows into the NBA Feature Store preview through `nba-injury-lineup-confidence.service.ts`. Stored lineup/depth rows contribute lineup availability, sample size, freshness and `sport_lineups` provenance to preview snapshots, but trial/scrambled rows still cannot improve production confidence and continue to surface warnings and penalties. Stored `sport_player_stats` rows now contribute a separate `player_stats_context` Feature Store value with sample size, freshness, season/game split and mapping quality, while trial-only player-stat rows remain architecture validation data and cannot remove production confidence penalties.

SportsDataIO NBA Trial Isolation Audit V1 is a read-only validation surface over stored Supabase rows. It checks SportsDataIO NBA rows across normalized tables for trial metadata and `production_eligible=false`, tolerates optional readiness tables that are not applied yet, and scans `prediction_history` for trial-event or trial-feature leakage.

SportsDataIO NBA Observability Integration V1 extends Runtime Observability V1 and now points at the direct readiness evidence, blocker-resolution, preflight, approval and completion routes. `/api/observability/runtime` and `RuntimeObservabilityPanel` include nested SportsDataIO NBA readiness and trial-isolation summaries, including blocker counts, external blocker ledger owner/gate summaries, readiness evidence export validation and route, production gate audit status, provider execution gate status, external blocker resolution checklist status and route, execution-readiness validation status, production usage exclusion audit status and route, next-pilot approval checklist status, preflight route, external approval packet status and route, blocked-state audit status, completion-audit route, domain completion proof ledger status, completion evidence matrix status, response-shape audit status, surface consistency audit status, readiness routes, stored-table audit totals, prediction leakage counts and safety invariants. `HistoricalImportEnginePanel` also reads the zero-call execution-readiness validation API directly and displays pass counts, closed guardrail statuses, pre-transport live-shape rejection and one-to-many counter evidence beside the import handoff controls. The aggregate readiness `surfaceConsistencyAudit` declares the readiness evidence export, blocker-resolution, execution-readiness validation, preflight, approval-packet and completion-audit signals across readiness, historical import and runtime observability surfaces. These surfaces use zero provider calls, perform no mutations and do not change production prediction, backtesting, model-training or confidence behavior.

### Feature Sets

Start with Feature Store Core definitions and add sport-specific registries before changing prediction engines. New feature sets must declare required and optional features, freshness policies, no-leakage rules and fallback behavior for unavailable provider data.

### New Prediction Engines

Start with `sport-prediction-engine-sdk.service.ts`, Feature Store Core and the Multi-Sport Feature Registry. Reuse Prediction Engine V4, Kelly, Smart Ranking, Adaptive Learning, Monte Carlo, Portfolio AI and existing persistence. Add sport-specific feature engineering and orchestration only. Engines must not read raw provider payload fields, fabricate unavailable injuries/lineups/player data or claim real accuracy before stored-data validation and historical calibration.

### New Dashboard Modules

Create focused panels under `src/components/dashboard`, fetch typed API responses and keep privileged mutations server-side behind protected routes.

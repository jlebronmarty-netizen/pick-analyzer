# Architecture

Pick Analyzer is a Next.js 16 App Router application with a service-heavy backend inside the same repository. It combines sports data synchronization, normalized multi-sport adapters, prediction generation, settlement, analytics, portfolio tools and dashboard panels.

## Next.js Structure

- `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/dashboard/page.tsx` and `src/app/model/page.tsx` define pages.
- `src/app/api/**/route.ts` contains 245 API route files.
- `src/app/dashboard/page.tsx` composes dashboard sections from `src/components/dashboard`.
- Protected operational routes commonly use `CRON_SECRET` with `Authorization: Bearer <secret>` or a `secret` query parameter.

## Services

Major service groups:

- Prediction: `prediction.service.ts`, `prediction-engine-v4.service.ts`, `prediction-history.service.ts`, `prediction-settlement.service.ts`, `nba-prediction-engine.service.ts`, `nba-prediction-validation.service.ts`, `nba-prediction-settlement.service.ts`.
- Production gating: `production-data-gate.service.ts` is the shared guard for production-eligible rows and is used by feature validation, prediction persistence, production metrics, CLV, calibration, backtesting, model learning, recommendations and portfolio-facing consumers.
- Recommendation eligibility: `recommendation-eligibility-policy.service.ts` builds on Production Data Gate V1 and classifies analyzed rows into `ANALYZED_ONLY`, `INELIGIBLE`, `WATCH`, `QUALIFIED`, `BEST_BET_CANDIDATE` and `PLAY_OF_DAY_CANDIDATE`. Official pick consumers use only qualified statuses; calibration remains probationary until sufficient settled production samples exist.
- Shared prediction SDK: `sport-prediction-engine-sdk.service.ts` defines provider-independent sport engine strategy/input/output contracts, market capability declarations, deterministic probability/edge/EV/recommendation building and integration contracts for Kelly, Smart Ranking, Monte Carlo, persistence, settlement and model health.
- Prediction versioning: `prediction_history` is the canonical prediction persistence table. Migration `202607170002_prediction_versioning_engine_v1.sql` adds `is_current`, `prediction_version`, `model_role`, `prediction_group_key`, parent/challenger pointers and `version_lineage`. Active betting surfaces use current champion rows; challenger and shadow rows are stored for comparison, rollback and historical analysis without overwriting prior predictions.
- Autonomous daily operations: `autonomous-daily-operations.service.ts` coordinates production-day status, protected execution planning, scheduler status, operational health, daily performance reporting, suggestion-only learning, simulation and demo views. Write-capable execution is `CRON_SECRET` protected, dry-run by default, confirmation-gated, idempotency-keyed and delegates eligible stages to the existing Operating Day executor. A live timing gate blocks date-level final refresh and recommendation lock when the operating-day cohort is no longer fully active pregame, and blocks results sync with `WAITING_FOR_FINALS` while any operating-day game remains active pregame or unresolved in stored terminal status.
- Shared settlement: `settlement-core.service.ts` defines generic moneyline/spread/total primitives plus deterministic multi-sport fixture coverage for common market, period, overtime, push and void contracts.
- Settlement reconciliation: `settlement-reconciliation.service.ts` audits stale pending `prediction_history` rows, classifies mutation eligibility, exposes a dry-run plan and refuses non-zero write execution until exact final-result scope is proven.
- Universal event identity: `universal-event-identity.service.ts` defines deterministic event identity normalization, evidence codes, resolver confidence states and read-only audits across `sport_events`, `prediction_history`, `sports_odds_snapshots`, `game_results`, `sport_game_stats`, `sport_player_stats` and `provider_entity_mappings`. It never trusts team-name/date-only matches for automatic repair and keeps write execution blocked unless exact candidates are separately reviewed.
- Missing canonical event recovery: `missing-canonical-events-recovery.service.ts` audits eventless prediction rows for stored source evidence, exact team identity coverage, provider retrieval blockers and planned mutation scope. `savePredictionHistory` prevents future production-eligible rows from persisting against missing canonical events by downgrading them with an `EVENT_IDENTITY_REQUIRED` warning.
- Scoring and risk: `smart-ranking.service.ts`, `kelly.service.ts`, `risk-grade.service.ts`, `adaptive-scoring.service.ts`, `adaptive-weight-engine.service.ts`.
- Model operations: `model-learning.service.ts`, `model-calibration.service.ts`, `model-versioning.service.ts`, `model-backtest.service.ts`, `self-learning-engine.service.ts`.
- Market intelligence: `clv.service.ts`, `clv-analytics.service.ts`, `closing-line-intelligence.service.ts`, `market-intelligence.service.ts`, `market-movement.service.ts`, `sharp-money.service.ts`, `sharp-money-intelligence.service.ts`.
- Model-only intelligence: `model-only-intelligence.service.ts` reads stored `prediction_history` and `universal_projection_history` to expose Most Likely model rankings, probable moneyline, informational parlays and pitcher-outs shadows without requiring odds or becoming Official Picks.
- Portfolio and bankroll: `portfolio-ai-v2.service.ts`, `portfolio-builder.service.ts`, `portfolio-optimizer.service.ts`, `portfolio-scoring.service.ts`, `portfolio-simulator.service.ts`, `bankroll.service.ts`, `bankroll-manager.service.ts`.
- Multi-sport: `multi-sport-registry.service.ts`, `multi-sport-providers.service.ts`, `multi-sport-adapters.service.ts`, `multi-sport-normalizers.service.ts`, `multi-sport-query.service.ts`, `multi-sport-health.service.ts`, `multi-sport-markets.service.ts`.
- Provider contracts: `provider-adapter-sdk.service.ts` defines provider-independent adapter contracts, endpoint capabilities, auth shape, pagination, rate-limit hints, retry hints and fixture validation.
- Import architecture: `historical-import-engine.service.ts` plans provider-independent historical imports, checkpoints, idempotency, dedupe keys, quota estimates and additive NBA/MLB/NFL/NHL/soccer V2 import manifests without executing provider calls.
- Feature store: `feature-store-core.service.ts` defines versioned feature definitions, computed snapshots, freshness, provenance, sample size, cutoff timestamps, invalidation keys and leakage validation.
- Historical feature generation: `historical-feature-generation.service.ts` plans dry-run and bounded write-mode leakage-safe historical pregame feature snapshots from persisted normalized records only, with deterministic IDs, lineage, trial/production gates, checkpoint contracts, durable snapshot persistence readiness and backtest input eligibility.
- Retrosheet historical feature store: `retrosheet-historical-feature-store.service.ts` defines Phase 2A point-in-time MLB historical feature bundles over persisted 2025 Retrosheet tables. It reuses `historical_feature_snapshots`, writes only historical-only/non-training/non-live-prediction rows when protected import execution is approved, records durable job/checkpoint metadata through existing job tables, and keeps Prediction Engine, Learning Brain, Current Board, Official Picks, markets, settlement and live Performance isolated.
- Feature registry: `multi-sport-feature-registry.service.ts` maps feature definitions into sport, market and model-specific feature sets with readiness states and fallback policies.
- NBA: `nba-adapter.service.ts`, `nba-data-sync.service.ts`, `nba-prediction-engine.service.ts`, `nba-prediction-validation.service.ts`, `nba-prediction-settlement.service.ts`.
- NBA feature integration: `nba-feature-store-integration.service.ts` previews and validates NBA Feature Store-compatible snapshots, including stored injury and unavailable-lineup confidence context.
- NBA injury/lineup confidence: `nba-injury-lineup-confidence.service.ts` reads stored NBA injury rows and static provider configuration state to produce confidence penalties, data sufficiency penalties, unresolved mapping warnings, trial-data isolation flags and lineup-unavailable context without provider calls.
- MLB feature integration: `mlb-feature-store-integration.service.ts` previews and validates MLB Feature Store-compatible snapshots, existing MLB storage signals and missing sport-specific domains without changing legacy MLB prediction generation.
- MLB feature/model readiness: `mlb-feature-model-readiness.service.ts` and `/api/mlb/features/model-readiness` compose the existing MLB Feature Store integration with current-season data-quality evidence to classify active, partial, blocked and unsafe model inputs. It proves leakage guardrails, reports feature snapshot readiness, keeps CLV/line movement blocked without genuine open/close odds and does not replace prediction architecture.
- MLB model audit: `mlb-model-audit.service.ts` and `/api/mlb/model-audit` audit stored MLB prediction history with no provider calls or writes. The audit excludes post-start predictions and rows without immutable feature snapshots, reports backtest/calibration metrics and preserves all recommendation thresholds unless future evidence-backed changes are explicitly approved.
- MLB player data excellence and pitcher outs: `mlb-player-data-excellence.service.ts` and `/api/mlb/player-data-excellence` audit exact provider-scoped player identity, pitcher stat coverage, baseball recorded-outs conversion, leakage-safe starter readiness, SHADOW / NO_MARKET recorded-outs projections and future player-prop provider contracts without provider calls or recommendation activation.
- MLB prediction engine: `mlb-prediction-engine.service.ts` builds deterministic moneyline, spread/run line and total previews through the Shared Sport Prediction Engine SDK without provider calls, persistence or production accuracy claims.
- MLB GamesByDate payload audit: `mlb-games-payload-audit.service.ts` reads stored `sport_events` and `sports_sync_jobs` evidence to report starter, weather and venue field coverage for `/api/mlb/games-payload-audit` with zero provider calls and zero writes.
- MLB GamesByDate provider verification: `mlb-games-by-date-verification.service.ts` powers the admin-only `/api/mlb/provider-verification/games-by-date` route. It constrains the provider path to `GamesByDate`, requires confirmation and budget approval, performs at most one provider call and stores only a sanitized field extract in `sports_sync_jobs`.
- MLB pitcher/bullpen intelligence: `mlb-model-platform.service.ts` exposes `/api/mlb/intelligence/pitcher-bullpen-foundation` as a cache-first analyst evidence layer over verified GamesByDate starter slots and cached `sport_player_stats`. It reports starter stat matches, relief row coverage, workload signals, cache freshness and explicit missing-data limitations without provider calls, prediction regeneration, official-policy changes or model promotion.
- MLB unresolved player identity: `mlb-unresolved-player-identity.service.ts` and `/api/mlb/players/unresolved-identities` preserve SportsDataIO MLB provider player IDs that appear in player-stat feeds before a trusted canonical player mapping exists. The workflow reuses `provider_entity_mappings` with `entity_type='unresolved_player'`, keeps those records non-production and review-required, and reconciles only through exact trusted mappings or manual/admin approval. It performs no provider calls and does not use fuzzy name matching.
- MLB current-season player-game-stat backfill: `mlb-current-season-backfill-orchestrator.service.ts` and `/api/mlb/historical-backfill/player-game-stats` provide a bounded resumable wrapper around the existing SportsDataIO MLB historical executor. The orchestrator plans eligible completed 2026 dates from stored events, skips completed checkpoints, refuses active or ambiguous jobs, caps each invocation by provider budget configuration and delegates provider transport to the durable one-date child executor.
- MLB current-season data-quality audit: `mlb-current-season-data-quality-audit.service.ts` and `/api/mlb/current-season/data-quality` provide a stored-data-only season audit for 2026 MLB teams, players, events, results, standings, team stats, player game stats, odds snapshots, predictions, settlements, feature snapshots, provider mappings, historical jobs and checkpoint coverage. It reports transparent quality scores, identity and mapping gaps, odds/CLV caveats and prediction-settlement readiness without provider calls or writes.
- MLB Prediction Engine V7: `sportsdataio-mlb-prospective-preview.service.ts` exposes protected `/api/mlb/predictions/v7-regeneration`. V7 reuses the existing prospective preview/versioning path, writes only challenger rows when confirmed, embeds Confidence Engine V2 decomposition and keeps official thresholds, champion rows and historical picks unchanged.
- BSN: `bsn-platform.service.ts` exposes source intelligence, provider capability matrix, data quality, dry-run sync planning, V7-style prediction preflight and AI Coach responses through `/api/bsn/capabilities`, `/api/bsn/data-quality`, `/api/bsn/sync`, `/api/bsn/predictions` and `/api/bsn/ai-coach`. It reuses normalized basketball tables and blocks official picks, EV and Best Value until approved BSN source ingestion plus verified odds exist.
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
- AI Sports Analyst V2: `sports-analyst.service.ts` and `/api/sports-analyst/game/[eventId]` provide deterministic game, model, market, risk, price-target and advantage-matrix explanations over existing Game Intelligence and market contracts. `player-intelligence.service.ts` and `/api/players/[playerId]/intelligence` expose stored player evidence and explicit `NO_MARKET` player-prop status.

## API Routes

The API surface includes:

- Core predictions: `/api/predictions/*`, `/api/prediction-engine/v4`.
- Autonomous daily operations: `/api/autonomous-daily-operations/status`, `/execute`, `/daily-report`, `/learning-report`, `/scheduler`, `/health`, `/simulation` and `/demo`.
- NBA: `/api/nba/sync/*`, `/api/nba/predictions/*`, `/api/nba/data-health`, `/api/nba/adapter/status`.
- BSN: `/api/bsn/capabilities`, `/api/bsn/data-quality`, `/api/bsn/sync`, `/api/bsn/predictions`, `/api/bsn/ai-coach`, plus legacy manual `/api/bsn/teams`, `/api/bsn/games` and `/api/bsn/results` routes.
- NBA features: `/api/nba/features/store`, `/api/nba/features/preview`, `/api/nba/features/validation`.
- MLB features: `/api/mlb/features/store`, `/api/mlb/features/preview`, `/api/mlb/features/validation`.
- MLB predictions: `/api/mlb/predictions`, `/api/mlb/predictions/health`, `/api/mlb/predictions/validation`.
- MLB diagnostics: `/api/mlb/games-payload-audit`, `/api/mlb/data-quality`, `/api/mlb/provider-capabilities/audit` and `/api/mlb/ai-coach` expose read-only MLB operational evidence without provider calls.
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
- Event identity diagnostics: `/api/events/identity/audit`, `/api/events/identity/unresolved`, `/api/events/identity/conflicts` and `/api/events/[eventId]/identity`.
- Event recovery diagnostics: `/api/events/recovery/missing-canonical`.
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
- Supabase-backed local data: BSN and project-owned persistence. BSN production use is currently source/odds blocked; existing local BSN tables are treated as legacy/manual data until normalized ingestion is approved.

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

Settlement Reconciliation Engine V2 (`settlement-reconciliation.service.ts`, `/api/settlement/reconciliation`) is the stored-data-only lifecycle authority for historical prediction outcomes. It supports `DRY_RUN`, `VALIDATE_ONLY`, `SINGLE_GAME`, `RANGE` and `FULL_RECONCILIATION`, classifies rows as Scheduled, AwaitingResult, Settled, Push, Cancelled, Voided, Historical, Replay, Shadow, Ignored, Legacy or Unknown, and records reason/source/timestamp/game/event/version/confidence metadata in `prediction_history.settlement_details.settlement_reconciliation_v2`. The exact V2 lifecycle is stored in JSON metadata while `lifecycle_status` remains compatible with the existing generated/active/skipped/closed/settled/void database constraint.

Performance Scope V2 and AI Performance Center read the V2 lifecycle metadata so timeline and Prediction History surfaces display explicit settlement states instead of ambiguous Pending labels. Reconciliation uses persisted `prediction_history` and `sport_events` only; provider calls, odds fetches, Current Board mutations, Learning Brain changes, replay generation and historical feature recalculation are outside this engine.

Settlement and performance event joins use bounded 100-ID batches for `sport_events` lookups to avoid Supabase/PostgREST request header overflow during full-history reconciliation.

## Production UX Recovery Boundary

Production Regression Audit & UX Recovery V1 is a presentation and read-aggregation recovery layer. It does not alter Prediction Engine probabilities, Learning Brain behavior, Current Board eligibility, Official Pick policy, market pipelines, provider access or historical feature-store data.

Most Likely can render stored model-only prediction rows as informational probability rows when safe Current Board market rows are unavailable. These rows are explicitly non-official, carry no actionable EV or stake, and remain separate from Best Value and Official Picks.

AI Performance Center treats Settlement V2 metadata as authoritative for production performance families. `Legacy`, `Ignored`, `Historical`, `Replay` and `Shadow` rows remain audit-visible in history and timeline views, but production trust, Brier, log loss, calibration and report-card metrics are calculated from production rows only.

## Build Memory Boundaries

Build Memory Optimization & Deployment Recovery V1 keeps backend capabilities intact while lowering peak build memory. `next.config.ts` enables Webpack memory optimizations, runs Webpack in a worker, disables parallel server compiles/traces and limits static generation concurrency.

Heavy admin pages such as `/admin/historical-diagnostics` and `/mlb-operations` are dynamic request-time pages. They load Retrosheet, historical feature-store and operations-center services through runtime `import()` calls instead of eager page-module imports.

Heavy operational routes keep their public contracts but lazy-load large service graphs inside request handlers. Historical import execution/planning, operations validation and operating-day cron routes import historical, feature, settlement, replay-prep and adaptive execution modules only when the matching runtime branch executes.

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

MLB Prospective Validation Day 1 readiness is exposed through the existing `/api/cron/daily-sync?version=2` dry-run response rather than a new route. The section is disabled by default and documents Puerto Rico capture windows, date-wide `GameOddsByDate` captures, event-aware cutoff selection, conservative call budgets, checkpoint/recovery behavior and quarantined Feature Store -> prediction -> settlement handoffs. The existing `/api/daily-report` response includes an `mlbValidation` section for labeled validation reporting while public pick surfaces still require `production_eligible=true`.

MLB Historical Recommendation Replay V1 reuses existing `/api/predictions/by-sport` instead of adding a replay route. The normal response still returns production-eligible top picks, while explicit `historicalValidation=true&validationMode=quarantined` returns only curated, linked MLB validation predictions for the requested date. The MLB Prediction Engine dashboard panel consumes that explicit mode to display settled historical replay rows and compact pregame lineage explanations without raw provider payloads or production labels.

Recommendation Experience and Official Picks Readiness V1 keeps the existing route surface while making `/api/predictions/top`, `/api/play-of-the-day`, `/api/parlays`, bankroll/portfolio consumers and the Bet Slip Optimizer depend on the shared recommendation policy. With current probationary calibration, official picks remain empty, Play of the Day remains unavailable and the optimizer returns a no-ticket state instead of constructing zero-leg odds or probability.

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

SportsDataIO MLB Line Movement Probe V1 and Expansion Batch V1 extend the same MLB normalization service for `GameOddsLineMovement/{gameid}` without adding routes, dashboards or tables. Line-movement rows use source-aware deterministic IDs under `sportsdataio:line_movement`, include provider timestamps in `snapshot_time` and metadata, do not infer opening or closing labels from array position, and keep `trial=false`, `scrambled=false`, `production_eligible=false` plus quarantine metadata. The one-game probe for GameId `78723` persisted 3,720 quarantined odds rows and proved timestamp-safe pregame movement exists. The approved 14-game expansion inserted 32,722 additional line-movement rows, giving all 15 `2026-JUL-12` events cutoff-safe moneyline, run-line and total coverage. The existing Feature Store route actions now have an MLB-bounded branch that maps provider `run_line` rows into the shared `spread` contract while preserving `providerMarket=run_line` in lineage metadata, selects cutoff-safe persisted odds only, persists quarantined non-production feature snapshots, links predictions through `prediction_history.feature_snapshot_id`, and settles only those linked rows through Settlement Core. No production prediction, Kelly/bankroll/portfolio action, model promotion or production CLV metric is enabled by this technical validation.

SportsDataIO Betting Market Normalization Core V1 lives in `src/services/sportsdataio-betting-normalizer.service.ts`. It is provider-independent and shared across future NBA, MLB, NFL, NHL and Soccer odds work. It separates betting event, game, market, outcome and sportsbook identifiers; classifies discovery, market-index, priced-outcome, archive-required, entitlement-blocked, empty and unsupported payloads; normalizes only actual priced outcomes; preserves unresolved identifiers; derives decimal odds and implied probability only from valid American prices; and routes older events to an archive-required state without inventing Historical API paths. Existing `/api/historical-import/execute` and runtime validation surfaces consume this logic without adding routes.

SportsDataIO NBA Integration Readiness V1 is the aggregate zero-call readiness surface. It composes runtime adapter validation, capability metadata, odds readiness, player prop readiness and player stat readiness into one status/blocker/safety-invariant API for handoff and observability. It also returns a domain handoff matrix for trial-complete areas, blocked production domains, production gates, safe next actions, objective completion audit, external blocker ledger, validated readiness evidence export, production gate audit, provider execution gate, external blocker resolution checklist and route, production usage exclusion audit and route, next-pilot approval checklist, external approval packet, blocked-state audit, domain completion proof ledger, completion evidence matrix, response-shape audit, surface consistency audit and next-pilot preflight summaries. `HistoricalImportEnginePanel` now renders a canonical Readiness Summary from `/api/providers/sportsdataio/nba/readiness` and uses those embedded preflight summaries instead of fetching odds, player-props and player-stats readiness separately. Focused proof/evidence/audit/action routes are compatibility aliases over sections of the canonical response; focused preflight routes remain operational aliases for approval workflows. It does not call Supabase or SportsDataIO and does not mark the integration production-ready while external endpoint, entitlement, migration, settlement, quota and real-data validation blockers remain.

NBA Stored Lineup Feature Enrichment V1 connects persisted `sport_lineups` rows into the NBA Feature Store preview through `nba-injury-lineup-confidence.service.ts`. Stored lineup/depth rows contribute lineup availability, sample size, freshness and `sport_lineups` provenance to preview snapshots, but trial/scrambled rows still cannot improve production confidence and continue to surface warnings and penalties. Stored `sport_player_stats` rows now contribute a separate `player_stats_context` Feature Store value with sample size, freshness, season/game split and mapping quality, while trial-only player-stat rows remain architecture validation data and cannot remove production confidence penalties.

SportsDataIO NBA Trial Isolation Audit V1 is a read-only validation surface over stored Supabase rows. It checks SportsDataIO NBA rows across normalized tables for trial metadata and `production_eligible=false`, tolerates optional readiness tables that are not applied yet, and scans `prediction_history` for trial-event or trial-feature leakage.

SportsDataIO NBA Observability Integration V1 extends Runtime Observability V1 and now points at the direct readiness evidence, blocker-resolution, preflight, approval and completion routes. `/api/observability/runtime` and `RuntimeObservabilityPanel` include nested SportsDataIO NBA readiness and trial-isolation summaries, including blocker counts, external blocker ledger owner/gate summaries, readiness evidence export validation and route, production gate audit status, provider execution gate status, external blocker resolution checklist status and route, execution-readiness validation status, production usage exclusion audit status and route, next-pilot approval checklist status, preflight route, external approval packet status and route, blocked-state audit status, completion-audit route, domain completion proof ledger status, completion evidence matrix status, response-shape audit status, surface consistency audit status, readiness routes, stored-table audit totals, prediction leakage counts and safety invariants. `HistoricalImportEnginePanel` also reads the zero-call execution-readiness validation API directly and displays pass counts, closed guardrail statuses, pre-transport live-shape rejection and one-to-many counter evidence beside the import handoff controls. The aggregate readiness `surfaceConsistencyAudit` declares the readiness evidence export, blocker-resolution, execution-readiness validation, preflight, approval-packet and completion-audit signals across readiness, historical import and runtime observability surfaces. These surfaces use zero provider calls, perform no mutations and do not change production prediction, backtesting, model-training or confidence behavior.

Current Board Intelligence Engine V1 lives in `src/services/current-board.service.ts` with optional route `/api/current-board`. It is the canonical read-only source for current betting-candidate selection across Most Likely, future Best Value readiness and Today/Daily Report counts. It consumes stored `prediction_history`, `sport_events` and `sports_odds_snapshots` rows, applies current-slate, freshness, anomaly, dedupe and exclusion accounting policies, and returns a typed candidate contract plus `uniqueRowsExcluded` and `exclusionReasonCounts`. It is not a prediction engine, official recommendation policy or production promotion mechanism. Top Picks, Play of the Day, parlays, Bet Slip, bankroll/portfolio, Kelly and AI Coach continue to require Production Data Gate V1 plus Recommendation Eligibility Policy V1 before any official recommendation can appear.

Sports Intelligence UI Integrity V1 extends the shared market layer without creating a second recommendation engine. `market-alignment.service.ts` now separates preserved snapshot edge/EV from actionable edge/EV and suppresses actionable values when market input is stale, expired, unknown or unaligned. `market-intelligence-category.service.ts` remains the canonical classifier and exposes canonical states across Official, AI Lean, Watchlist, Avoid, No Market, Stale, Invalid, Quarantined, Insufficient Data and Shadow while preserving legacy four-category fields for compatibility. Most Likely, Best Value, Betting Workbench, AI Bet Finder, Today and AI Picks Feed consume these shared outputs.

Game Intelligence V1 lives in `src/services/game-intelligence.service.ts` and `/api/games/[eventId]/intelligence`. It is a stored-data-only event detail foundation over `sport_events`, Current Board candidates, market alignment, market classification and recommendation explanations. It reports unsupported lineups, injuries, verified props and multi-book movement explicitly as unavailable and makes zero provider calls and zero remote mutations.

MLB Operating Day Lifecycle V1 lives in `src/services/operating-day.service.ts` and additive migration `supabase/migrations/202607170001_mlb_operating_day_lifecycle_v1.sql`. It introduces `operating_days`, `operating_day_events`, lifecycle audit events, recommendation lock snapshots and stored operating-day reports. Write actions go through protected `/api/operating-day/execute`; read status uses `/api/operating-day/status`; scoped settlement uses `/api/operating-day/[operatingDayId]/settle`. The orchestrator reuses existing MLB prospective preview, Current Board, result sync, calibration and learning services instead of duplicating model logic. The SportsDataIO MLB final refresh path now resolves persisted prospective events first when `operatingDayFinalRefresh=true`, skips schedule rediscovery, and returns `locked_or_started` without odds calls after start/lock. Result sync now surfaces quota rejection as `quota_blocked` rather than a successful outer response. Official locked picks and hypothetical replay outcomes are stored and reported separately.

MLB Next Slate Rollover V1 lives in `src/services/active-event.service.ts` and `src/services/next-slate.service.ts`. The active-event service centralizes sport/league/date/status filters for Current Board, MLB prospective preview and operating-day planning so started, final, postponed, canceled, suspended, historical-only or locked rows do not appear as active betting opportunities. `GET /api/slate/next/status` is a read-only stored-data resolver that selects the earliest future Puerto Rico MLB slate, reports schedule/odds/prediction readiness and returns the bounded SportsDataIO endpoint plan with zero provider calls. Operating-day planning actions for next-slate preview and preparation remain read-only unless a future explicitly approved transport path is added.

MLB Live Data Refresh V1 extends the operating-day orchestrator so authenticated, confirmed `prepare_next_slate` can execute the existing SportsDataIO MLB prospective-preview pipeline under provider budget and action-lock controls. Provider call budget status lives at `/api/providers/budget/status`; market support lives at `/api/mlb/markets/capabilities`; automation status lives at `/api/operating-day/automation/status`; `/api/cron/operating-day` is the consolidated scheduler entry. Core recommendation policy, production gates, official history and scoped settlement remain unchanged.

MLB Odds Coverage Reconciliation V1 keeps that pipeline on the existing data path: SportsDataIO `GameOddsByDate` raw provider record -> provider game ID -> existing or repaired provider mapping -> `sport_events` -> normalized `sports_odds_snapshots` -> feature snapshot -> prospective `prediction_history` row -> Current Board candidate. The repair scopes selected MLB dates to the America/Puerto_Rico operating-day interval before resolving persisted events, so late local games that fall after midnight UTC are not dropped. The coverage diagnostic route is read-only and reports both stored analysis coverage and stricter Current Board actionability; 15/15 games can have mapped odds and predictions while only a smaller subset is actionable after price, freshness, anomaly and supersession filtering.

MLB market support remains intentionally narrow. Full-game moneyline, run line/spread and total are the only verified production-analysis markets in the current SportsDataIO payload. Team totals, first-five/first-inning markets, alternate lines, NRFI/YRFI, pitcher props and batter props stay unavailable or ingestion-blocked until the provider payload, normalizer, feature builder, settlement rule and calibration contract are all verified.

Vercel deployment uses one Hobby-compatible daily cron on `/api/cron/operating-day` (`0 12 * * *`). Intraday refreshes are delegated to the GitHub Actions external scheduler workflow when `PICK_ANALYZER_BASE_URL` and `PICK_ANALYZER_CRON_SECRET` repository secrets are configured. The scheduler endpoint remains idempotent and decides the due stage from stored operating-day state, slate freshness and provider budget.

Operating Day Cron Reliability V1 keeps the consolidated cron route compact and auditable. When the selected MLB slate is already fresh, real cron execution returns `already_current` with zero provider calls and zero writes instead of running a redundant provider-preparation branch or serializing the full provider payload. Automation status distinguishes configured Vercel cron, unverified external scheduler secrets and actual multi-refresh activation.

MLB Data Quality V1 is a read-only scoring layer over stored Current Board candidates. It canonicalizes missing critical MLB inputs from stored snapshot warnings and reports feature quality, data sufficiency, critical data completeness and labels such as `INSUFFICIENT`. Missing starting pitchers, confirmed lineups, injury diagnosis, weather and bullpen context cap readiness scores; they do not fabricate data or alter official-pick thresholds.

MLB Provider Capability Audit V1 reads the SportsDataIO endpoint catalog and current stored data to separate confirmed Discovery Lab endpoints from enterprise-only endpoints. It does not call SportsDataIO. Starting pitcher and weather engines remain blocked until `GamesByDate` fields or another authorized source are verified; lineup, injury and prop endpoints are enterprise-only for the current MLB subscription and must not be called through Discovery Lab. MLB AI Coach V1 is a deterministic internal-data explainer over Current Board, data quality and provider capability audit results. It uses no LLM and cannot promote picks.

Prediction Versioning Corrective Verification V1 confirms that V6 can persist side-by-side with existing champion rows after `202607170003_prediction_versioning_drop_legacy_unique_pick.sql` is applied remotely. V6 rows are stored as `model_role=challenger` and `is_current=false`; default Current Board calls continue to consume only current champion rows after versioning, while `modelRole=challenger` is an explicit inspection mode. MLB Model Platform Guardrails V1 (`src/services/mlb-model-platform.service.ts`) exposes read-only comparison and shadow-evaluation routes, dry-run-only promotion and rollback plans, and zero-provider-call player metadata, stadium metadata and pitcher/bullpen foundation audits. These routes do not promote models, regenerate predictions, settle rows, alter official history or consume provider quota.

Autonomous Daily Operations V1 lives in `src/services/autonomous-daily-operations.service.ts` and `/api/autonomous-daily-operations/status`. It is the canonical read-only daily operations summary for demos and operator review. It composes existing operating-day, provider-budget, Current Board, Best Bets, Most Likely, Best Value, AI Coach, data-quality, pitcher/bullpen, comparison, shadow, calibration and promotion-readiness services instead of rebuilding them. It returns the daily answer, opportunity summary, game cards, timeline, compact system health, learning report and promotion checklist with `providerCallsMade=0`, `remoteMutationsMade=0`, immutable history and no automatic promotion. Real execution/persistence remains in the existing operating-day executor and `operating_day_lifecycle_events`.

Intelligence Suite V2 adds optional premium workspaces over that same Current Board contract. Best Value Scanner V1 (`src/services/best-value-scanner.service.ts`, `/api/market-opportunities/best-value`, `/best-value`) ranks current candidates by display-only modeled-value signals and returns no candidates by default when positive edge/EV are absent. AI Bet Finder V1 (`src/services/ai-bet-finder.service.ts`, `/api/ai-bet-finder`, `/ai-bet-finder`) is a deterministic natural-language router for search, compare, explain, ticket building and change review. It does not invoke an LLM, does not query providers, does not mutate Supabase, does not recalculate model probabilities and does not bypass official gates. Raw prediction-history access is reserved for immutable version comparison in What Changed.

Market Intelligence Engine V1 (`src/services/market-intelligence-engine.service.ts`, `/api/market-intelligence`) is the compact scanner layer above Current Board. It classifies every supported or cataloged market as Elite, Strong Value, Watch, Pass or Unavailable and assigns display-only health and score values from already-computed candidate fields. It does not create predictions, connect to providers, mutate Supabase or bypass production/recommendation gates. Unsupported market families such as team totals, first-half, first-five, player props, pitcher props, specials and futures remain visible as unavailable extension points until verified data, features and settlement contracts exist.

Day 1 Recommendation Readiness V1 (`src/services/day1-recommendation-readiness.service.ts`, `/api/recommendation-readiness`) audits the complete recommendation path without provider calls or mutations. It reuses one Current Board snapshot, evaluates each candidate through Recommendation Eligibility Policy V1, checks Top Picks and Bet Slip official-only behavior, summarizes AI Bet Finder prompt expectations and runs an in-memory excellent-value production scenario to prove automatic activation would work when all gates are honestly satisfied.

Legacy Prediction Provenance V1 (`src/services/legacy-prediction-provenance.service.ts`, `/api/predictions/provenance`) is the read-only origin classifier for old `prediction_history` rows. It combines stored row fields, The Odds API legacy shape, git writer lineage and migration timeline evidence to classify legacy non-production rows without deleting data or manufacturing event links. Settlement Reconciliation consumes the same classifier and reports those rows as `LEGACY_PROVENANCE_NON_PRODUCTION`; production metrics continue to require explicit production eligibility and canonical lineage.

MLB Learning Brain V1 (`src/services/mlb-learning-brain.service.ts`, `/api/mlb/learning-brain`) is the controlled stored-data learning loop for pitcher recorded-outs shadow projections. It reuses `sport_player_stats`, `sport_events`, `universal_projection_history`, Player Intelligence, Game Intelligence, Operations Validation and the existing projection board. It centralizes recorded-outs unit normalization and direct/innings conflict quarantine, builds timestamp-safe feature contracts, reports starter-evidence coverage, stores eligible shadow projections in `universal_projection_history`, derives settlement and learning metrics from settled projection rows, and keeps champion/challenger promotion sample-gated. Pitcher-outs market status remains `NO_MARKET`; no Official Picks, EV, edge, Kelly or stake are generated.

MLB Pregame Starter Evidence V1 (`src/services/mlb-pregame-starter-evidence.service.ts`, `/api/mlb/pregame-starter-evidence`) is the canonical starter-evidence ingestion layer for pitcher-outs shadows. It audits the existing SportsDataIO Discovery Lab `GamesByDate` source, uses the existing protected one-call verification path for live refresh, and stores confirmed/probable starter evidence in `sport_lineups` with schema-safe confirmation levels plus exact status, source timestamp, freshness, identity method, evidence codes and eligibility metadata. The Learning Brain reads these rows before event metadata and only generates pitcher-outs shadow projections from exact, fresh, pregame starters with sufficient stored recorded-outs history. Game Intelligence, Player Intelligence and the Projections Learning Center surface the evidence while preserving `NO_MARKET`.

### Feature Sets

Start with Feature Store Core definitions and add sport-specific registries before changing prediction engines. New feature sets must declare required and optional features, freshness policies, no-leakage rules and fallback behavior for unavailable provider data.

### New Prediction Engines

Start with `sport-prediction-engine-sdk.service.ts`, Feature Store Core and the Multi-Sport Feature Registry. Reuse Prediction Engine V4, Kelly, Smart Ranking, Adaptive Learning, Monte Carlo, Portfolio AI and existing persistence. Add sport-specific feature engineering and orchestration only. Engines must not read raw provider payload fields, fabricate unavailable injuries/lineups/player data or claim real accuracy before stored-data validation and historical calibration.

### New Dashboard Modules

Create focused panels under `src/components/dashboard`, fetch typed API responses and keep privileged mutations server-side behind protected routes.

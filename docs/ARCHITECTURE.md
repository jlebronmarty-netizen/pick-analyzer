# Architecture

Pick Analyzer is a Next.js 16 App Router application with a service-heavy backend inside the same repository. It combines sports data synchronization, normalized multi-sport adapters, prediction generation, settlement, analytics, portfolio tools and dashboard panels.

## Next.js Structure

- `src/app/page.tsx`, `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/app/dashboard/page.tsx` and `src/app/model/page.tsx` define pages.
- `src/app/api/**/route.ts` contains 174 API route files.
- `src/app/dashboard/page.tsx` composes dashboard sections from `src/components/dashboard`.
- Protected operational routes commonly use `CRON_SECRET` with `Authorization: Bearer <secret>` or a `secret` query parameter.

## Services

Major service groups:

- Prediction: `prediction.service.ts`, `prediction-engine-v4.service.ts`, `prediction-history.service.ts`, `prediction-settlement.service.ts`, `nba-prediction-engine.service.ts`, `nba-prediction-validation.service.ts`, `nba-prediction-settlement.service.ts`.
- Shared prediction SDK: `sport-prediction-engine-sdk.service.ts` defines provider-independent sport engine strategy/input/output contracts, market capability declarations, deterministic probability/edge/EV/recommendation building and integration contracts for Kelly, Smart Ranking, Monte Carlo, persistence, settlement and model health.
- Scoring and risk: `smart-ranking.service.ts`, `kelly.service.ts`, `risk-grade.service.ts`, `adaptive-scoring.service.ts`, `adaptive-weight-engine.service.ts`.
- Model operations: `model-learning.service.ts`, `model-calibration.service.ts`, `model-versioning.service.ts`, `model-backtest.service.ts`, `self-learning-engine.service.ts`.
- Market intelligence: `clv.service.ts`, `clv-analytics.service.ts`, `closing-line-intelligence.service.ts`, `market-intelligence.service.ts`, `market-movement.service.ts`, `sharp-money.service.ts`, `sharp-money-intelligence.service.ts`.
- Portfolio and bankroll: `portfolio-ai-v2.service.ts`, `portfolio-builder.service.ts`, `portfolio-optimizer.service.ts`, `portfolio-scoring.service.ts`, `portfolio-simulator.service.ts`, `bankroll.service.ts`, `bankroll-manager.service.ts`.
- Multi-sport: `multi-sport-registry.service.ts`, `multi-sport-providers.service.ts`, `multi-sport-adapters.service.ts`, `multi-sport-normalizers.service.ts`, `multi-sport-query.service.ts`, `multi-sport-health.service.ts`, `multi-sport-markets.service.ts`.
- Provider contracts: `provider-adapter-sdk.service.ts` defines provider-independent adapter contracts, endpoint capabilities, auth shape, pagination, rate-limit hints, retry hints and fixture validation.
- Import architecture: `historical-import-engine.service.ts` plans provider-independent historical imports, checkpoints, idempotency, dedupe keys and quota estimates without executing provider calls.
- Feature store: `feature-store-core.service.ts` defines versioned feature definitions, computed snapshots, freshness, provenance, sample size, cutoff timestamps, invalidation keys and leakage validation.
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
- SportsDataIO execution readiness: `/api/providers/sportsdataio/status`, `/api/providers/sportsdataio/capabilities`, `/api/historical-import/execute`, `/api/historical-import/resume`, `/api/historical-import/cancel`, `/api/historical-import/jobs/[jobId]`, `/api/historical-import/pilot-plan`, `/api/historical-import/validate/[jobId]`.
- Historical import planning: `/api/historical-import/plan`, `/api/historical-import/health`, `/api/historical-import/jobs`.
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

NBA Feature Store Integration V1 is read-only. It validates NBA compatibility with Feature Store Core and uses existing `prediction_history.feature_snapshot` as the current persistence surface. NBA Injury and Lineup Confidence Integration V1 enriches optional `injury_context` and `lineup_context` with stored injury availability, stale-feed penalties, unresolved mapping warnings, trial-data exclusion flags and explicit lineup-unavailable status.

NBA Prediction Engine V1 consumes the injury/lineup confidence status conservatively. Trial/scrambled injuries can validate architecture but cannot improve production confidence. Missing or stale injury data is not interpreted as a healthy roster. Missing expected lineups create confidence warnings until a confirmed provider endpoint is approved.

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

Feature Store Core V1 defines computed, provider-independent feature snapshots. A snapshot includes feature definition versions, provenance, freshness, sample size, quality, sufficiency, cutoff timestamps and invalidation keys. Durable persistence is deferred; current compatibility uses `prediction_history.feature_snapshot` where predictions already persist feature context.

## Historical Import Pipeline

Historical Import Engine Core V1 sits between provider adapters and persistence. It is currently dry-run only and uses normalized sport, league and data-type concepts to plan date-range or season checkpoints. It reuses Provider Intelligence V1 for capability routing and Sync Reliability Framework V1 for retry, cursor and idempotency contracts. Future provider-backed execution must write normalized records and must not expose provider-specific payload fields to sport prediction engines.

## Settlement Pipeline

General settlement exists in `prediction-settlement.service.ts` and `prediction-history.service.ts`.

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

Start with dry-run plans from `historical-import-engine.service.ts`. SportsDataIO execution readiness is isolated in `sportsdataio-runtime-adapter.service.ts` and `sportsdataio-historical-import-readiness.service.ts`; it validates guardrails, pilot plans, domain contracts, resume/cancel shapes and post-import validation contracts. Live execution is only allowed for narrow capped pilot shapes with explicit approval. SportsDataIO NBA Pilot Import V1 confirmed `Teams` and `GamesByDate/2025-DEC-25`, used 2 external calls, persisted trial/scrambled teams metadata, provider mappings, events, scores and sync-job metadata, and marked pilot records as `production_eligible=false`. SportsDataIO NBA Pilot Import V2 confirmed `GamesByDate/2025-DEC-26`, `Standings/2026`, `TeamSeasonStats/2026` and `TeamGameStatsByDate/2025-DEC-26`; it persisted trial-isolated events, standings, team season stats and game stats under stable upsert keys. SportsDataIO NBA Players Pilot V1 confirmed `Players`, persisted 579 trial-isolated `sport_players` rows plus 579 player provider mappings, and treats those rows as roster identity/import-path validation only. Integer-only columns must receive integer values; decimal provider metrics should remain in JSON metadata or explicitly typed numeric columns. Large provider-ID preflight reads should be chunked before Supabase upserts. The legacy `team_stats` table stores NBA season by start year (`2025` for the 2025-26 season), while normalized NBA sync tables use the provider season key (`2026`). Trial events and trial roster rows are excluded from production prediction generation, validation, calibration and backtesting. Broader historical reconciliation remains blocked until explicit quota and date-window approval. Imports should be checkpointed, resumable, idempotent and mapped through `provider_entity_mappings` before writing normalized tables.

SportsDataIO NBA Injuries Pilot V1 is complete for the approved trial scope. The confirmed endpoint is `/v3/nba/projections/json/InjuredPlayers`; the pilot persisted trial-isolated `sport_injuries` rows and injury provider mappings while preserving unresolved players and teams as warnings. The earlier `/v3/nba/scores/json/Injuries` probe returned HTTP 404 and should remain historical evidence only. Trial injuries must not feed production confidence, real ROI, calibration, model training or betting recommendations.

NBA Injury and Lineup Confidence Integration V1 is the provider-independent consumer layer for those stored injury rows. It routes injury availability into Feature Store previews, NBA prediction feature quality, data sufficiency, risk warnings, explanations, Prediction Safety Framework warnings, Model Health V2 checks and dashboard observability. It does not call SportsDataIO, infer missing lineups, persist production picks or treat trial records as production-eligible.

SportsDataIO NBA Depth Charts and Starting Lineups Pilot V1 has a guarded execution path for `/v3/nba/scores/json/DepthCharts` and `/v3/nba/projections/json/StartingLineupsByDate/2025-DEC-26`. Normalized depth-chart and lineup relationship rows use `sport_lineups`, introduced by the non-destructive migration `supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql` and applied remotely. Trial lineup/depth rows must be marked `trial=true`, `scrambled=true` and `production_eligible=false`; they may validate architecture but must not improve production confidence, feed backtesting, feed calibration, train models or persist production recommendations. The first migration-backed live endpoint validation returned HTTP 200 for both approved endpoints but produced zero normalized rows from the trial/scrambled payload shape, so persistence remains empty until the SportsDataIO lineup/depth normalizers are updated from an approved payload-shape review.

### Feature Sets

Start with Feature Store Core definitions and add sport-specific registries before changing prediction engines. New feature sets must declare required and optional features, freshness policies, no-leakage rules and fallback behavior for unavailable provider data.

### New Prediction Engines

Start with `sport-prediction-engine-sdk.service.ts`, Feature Store Core and the Multi-Sport Feature Registry. Reuse Prediction Engine V4, Kelly, Smart Ranking, Adaptive Learning, Monte Carlo, Portfolio AI and existing persistence. Add sport-specific feature engineering and orchestration only. Engines must not read raw provider payload fields, fabricate unavailable injuries/lineups/player data or claim real accuracy before stored-data validation and historical calibration.

### New Dashboard Modules

Create focused panels under `src/components/dashboard`, fetch typed API responses and keep privileged mutations server-side behind protected routes.

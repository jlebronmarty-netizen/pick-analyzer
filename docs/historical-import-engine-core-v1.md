# Historical Import Engine Core V1

## Status

Completed as a provider-independent, dry-run planning layer. It does not call external providers, consume quota, mutate production data or require a migration.

## Objective

Create the shared architecture for future historical imports before premium provider data is activated. The engine plans imports over normalized project concepts instead of provider-specific payload fields.

Provider data must flow through:

1. Provider adapter.
2. Normalized domain models.
3. Historical Import Engine checkpoints.
4. Normalized persistence.
5. Feature store and sport prediction engines.

## Implementation

- Service: `src/services/historical-import-engine.service.ts`
- Dashboard panel: `src/components/dashboard/HistoricalImportEnginePanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/historical-import/plan`
  - `POST /api/historical-import/plan`
  - `GET /api/historical-import/health`
  - `GET /api/historical-import/jobs`

## Capabilities

Core V1 supports:

- provider-independent import job plans
- season and date-range scopes
- resumable checkpoint contracts
- retry policy reuse from Sync Reliability Framework V1
- idempotency keys
- dedupe keys
- provider route planning through Provider Intelligence V1
- batching by configurable day windows
- quota estimation
- progress shape for future execution
- partial failure isolation by checkpoint
- import validation
- read-only import health from existing Supabase metadata
- additive multi-sport import planning for NBA, MLB, NFL, NHL and soccer through the existing plan response
- historical feature generation handoff through the existing plan response

## Dry-Run Behavior

All responses force `dryRun: true`.

If a request sends `dryRun: false`, Core V1 returns a warning and still does not execute a provider import. This is intentional because provider-backed historical execution needs explicit quota approval and execution guardrails.

`providerUsage.externalProviderCallsMade` is always `0`.

The additive `multiSportPlanning` section is also planning-only. It declares sport-specific dependency order, destination tables, natural keys, conflict targets, request caps, checkpoint/resume strategy, trial isolation defaults, data-quality/Feature Store/prediction-preview handoffs and approval gates for NBA, MLB, NFL, NHL and soccer. It does not confirm provider endpoints or execute provider transport.

The additive `featureGenerationHandoff` section is planning-only, and the existing plan response also includes a dry-run `historicalFeatureSnapshotWritePilot` summary when schema readiness allows it. These sections report required source domains, blocking missing domains, inclusive prediction cutoff strategy, estimated event/snapshot counts, batch size, checkpoint strategy, persistence readiness, write-mode availability, leakage validation readiness and backtest handoff readiness from Historical Feature Generation Orchestrator V1.

## Persistence

Core V1 does not add tables and does not write rows. It reads:

- `sports_sync_jobs`
- `provider_entity_mappings`

Future execution can use `sports_sync_jobs.metadata` for simple job state. A dedicated import checkpoint table may be added later if durable resume state needs more structure than existing sync job metadata can safely provide.

## Validation Rules

The planner validates:

- configured `sportKey`
- optional league registration
- supported historical import data types
- season or date-range scope presence
- valid `YYYY-MM-DD` date ranges
- date order
- provider capability route availability

Unsupported provider capabilities return blocked checkpoints and warnings instead of fabricated records.

## Quota Estimation

Estimated provider calls are calculated from planned executable checkpoints. A checkpoint normally represents one provider request for one data type and one date/season batch.

Quota impact is classified as:

- `none`: zero executable checkpoints
- `low`: small internal or low-cost plans
- `medium`: medium-cost provider or moderate call volume
- `high`: high-cost provider or large call volume

These are estimates only. Core V1 never executes the calls.

## Checkpoint Model

Each checkpoint includes:

- scope: `date_range` or `season`
- sport, league and provider
- data type
- season/date window
- status: `planned` or `blocked`
- cursor contract
- idempotency key
- dedupe key
- estimated provider calls
- warnings

The idempotency key combines sport, league, provider, data type, season and date window so execution can be safely retried later.

## Dashboard

The dashboard panel appears in Multi-Sport Coverage and shows:

- import health
- recent sync job metadata
- provider mapping count
- sample NBA dry-run plan
- checkpoint count
- executable vs blocked checkpoints
- quota estimate
- zero provider calls
- warnings

There is no execution button in Core V1.

## Multi-Sport Planning V2

The existing `/api/historical-import/plan` route now returns:

- `multiSportPlanning.mode`: `historical_import_multi_sport_planning_v2`
- `multiSportPlanning.providerCallsMade`: `0`
- `multiSportPlanning.sports`: planning contracts for `basketball_nba`, `baseball_mlb`, `americanfootball_nfl`, `icehockey_nhl` and `soccer`
- `multiSportPlanning.dependencyGraph`: per-sport domain dependencies with readiness classifications
- `multiSportPlanning.validation`: deterministic zero-call checks for priority-sport coverage, concurrency, retry policy, trial isolation, dependency indexes and nonnegative one-to-many counters

Each sport plan includes supported domains, dependency order, domain manifests, destination tables, natural keys, conflict targets, request caps, season/date-range scope support, checkpoint/resume strategy, trial isolation defaults, provider-call accounting, record accounting and handoffs into data-quality, Feature Store and prediction-preview validation.

Domain manifests distinguish `current_api`, `recent_historical_feeds`, `archived_historical_api_required`, `unsupported_domain`, `entitlement_blocked`, `migration_pending`, `pilot_validated_current_feed`, `pilot_validated_date_feed`, `pilot_validated_season_date_feeds`, `trial_only_execution` and approval-required states without inventing endpoint paths. They also declare scope types, dependency indexes, maximum provider-call/record budgets, stable ID components, conflict targets, one-to-many expansion possibility and validation/feature-generation/settlement/backtesting handoffs.

NBA manifests use per-domain persistence contracts. Scores/results use provider event/game identity, standings use sport/league/season/team/provider identity, players use provider player identity, injuries use provider injury identity or a stable player/team/status/source key, lineups use the validated depth/lineup natural key, team and game stats use team/event stat scope, player stats use season/stat type/event/team/player identity, odds use event/market/period/sportsbook/selection/snapshot timestamp identity and player props remain contract-only around provider event/market/outcome/sportsbook identity.

Sport-specific notes are explicit. NBA flags trial SportsDataIO rows, lineup confidence gates and discovery-only BettingEvents. MLB flags doubleheaders, starting pitchers, bullpen workload, suspended/resumed games and extra innings. NFL flags season type, week/playoff round, quarter/overtime scoring and quarterback/injury/depth-chart gates. NHL flags regulation/overtime/shootout outcomes, starting goalie, line combinations, scratches and special teams. Soccer flags competition/season/stage/group/round, 1X2 markets, two-leg ties, extra time, penalties, qualification outcomes and first-half scoring.

Validation on 2026-07-14 used the existing plan/build path and returned `historical_import_engine_core_v1`, `historical_import_multi_sport_planning_v2`, five sport plans, zero provider calls and nonnegative one-to-many counter validation for the 39 provider records -> 758 normalized rows fixture. The API route count remained 205.

## Historical Feature Generation Handoff

The existing `/api/historical-import/plan` route now includes `featureGenerationHandoff.mode = historical_feature_generation_orchestrator_v1`.

The handoff is blocked for production execution because linked production prediction rows, prices, closing snapshots and sufficient settled production samples are still missing. Runtime schema probing verifies whether the durable generic historical feature snapshot schema is applied; the bounded trial write path is implemented and verified for stored NBA trial rows.

Schema migration: `supabase/migrations/202607140001_historical_feature_snapshots_v1.sql`

The planned stable natural key is:

`sport:event_id:market:prediction_cutoff:model_version:feature_set_version:execution_mode`

The handoff makes zero provider calls and must never read raw provider payloads directly.

When the server schema probe succeeds, `/api/historical-import/plan` reports `featureGenerationHandoff.persistenceReadiness.status = ready` and a dry-run write-pilot summary. The verified bounded pilot found 15 eligible NBA trial candidates under the 5-event/3-market/15-snapshot cap. Backtest eligibility can still remain closed for missing linked prediction snapshots, valid prices, closing snapshots or settled production sample reasons.

## Future Execution Phase

A future provider-backed phase should add:

- explicit user-approved provider and quota caps
- protected execution routes
- durable checkpoint persistence if needed
- provider adapter execution through the Provider Adapter SDK
- per-checkpoint writes to normalized tables
- post-run quality delta reporting

That phase must remain incremental and must not run full historical imports without explicit approval.

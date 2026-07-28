# Full Platform Audit V1 System Map

## Canonical Flow

Provider Layer -> Ingestion -> Normalization -> Canonical Identity -> Storage -> Features -> Prediction -> Ranking -> Official Pick Policy -> Product Surfaces -> Result Ingestion -> Settlement -> Learning Evidence -> Performance -> AI Briefing -> Operations Monitoring

| Stage | Canonical Implementation | Alternate / Wrappers | Persistence | Product Consumers |
| --- | --- | --- | --- | --- |
| Provider Layer | SportsDataIO, The Odds API, MLB Stats API services | provider capability/readiness auditors | provider budget, sports_sync_jobs | Providers, Operations |
| Ingestion | sync/prospective preview/result sync services | historical/import pilots | sports_odds_snapshots, sport_events, game_results | Dashboard, Current Board |
| Normalization | provider-time, market, identity normalizers | sport-specific adapters | canonical ids in sport_events/game_results | Prediction engines |
| Canonical Identity | universal-event-identity and provider_entity_mappings | sport-specific crosswalk helpers | provider_entity_mappings, sport_events.provider_ids | Settlement, projections |
| Storage | Supabase service-role repositories/services | route-local reads | prediction_history, odds, results, features | all product pages |
| Features | historical_feature_snapshots and feature store services | sport preview feature routes | historical_feature_snapshots | predictions, learning |
| Prediction | sport prediction SDK and MLB preview/prediction services | legacy V6/V7 regeneration routes | prediction_history | board, probability picks |
| Ranking | current-board, market opportunity, best-value services | page-level summaries | prediction_history plus odds | dashboard, board pages |
| Official Pick Policy | recommendation readiness/top-picks policy services | product guardrail text | prediction_history flags | picks surfaces |
| Product Surfaces | dashboard, AI operations, sports center, performance | diagnostic/admin pages | read-only service views | users/operators |
| Result Ingestion | results-sync / MLB Stats canonical game_results | The Odds API scores for approved scopes | game_results, sport_events status | settlement, lifecycle |
| Settlement | operating-day settlement path using game_results | reconciliation V2 compatibility metadata | prediction_history settlement fields | performance, learning |
| Learning Evidence | AI learning lifecycle derived queue | no standalone canonical learning_labels table | prediction_history + model_weight_history | AI Operations, model pages |
| Performance | performance/AI performance services | report-card/trust routes | prediction_history, model history | Performance page/API |
| AI Briefing | AI operations/briefing services | Autonomous Daily AI summaries | read-only summaries | executive surfaces |
| Operations | adaptive refresh, cron, operating-day execute | GitHub/Vercel trigger wrappers | operating_days, lifecycle, sync jobs | admin/ops pages |

## Import Hotspots

- @/services/current-board.service: 32
- @/services/provider-time-normalization.service: 29
- @/services/feature-store-core.service: 24
- @/services/top-picks.service: 24
- @/services/production-data-gate.service: 21
- @/services/sport-prediction-engine-sdk.service: 21
- @/services/provider-budget.service: 19
- @/services/bsn-platform.service: 17
- @/services/nba-data-sync.service: 16
- @/services/active-event.service: 15
- @/services/multi-sport-resolution.service: 14
- @/services/multi-sport-query.service: 14
- @/services/market-semantics.service: 13
- @/services/bankroll.service: 12
- @/services/model-learning.service: 12
- @/services/provider-intelligence.service: 12
- @/services/sportsdataio-runtime-adapter.service: 12
- @/services/recommendation-eligibility-policy.service: 11
- @/services/multi-sport-feature-registry.service: 11
- @/services/mlb-model-platform.service: 11
- @/services/model-calibration.service: 11
- @/services/bsn-intelligence-engine.service: 10
- @/services/data-foundation-coverage.service: 10
- @/services/mlb-player-projection-engine.service: 10
- @/services/mlb-starter-intelligence.service: 10

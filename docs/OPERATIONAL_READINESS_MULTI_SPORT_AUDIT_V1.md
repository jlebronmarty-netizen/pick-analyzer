# Operational Readiness Multi-Sport Audit V1

Date: 2026-07-29

Status: READ-ONLY AUDIT

No provider calls. No production mutation. No prediction writes. No settlement writes. No model training.

## Executive Verdict

Pick Analyzer is **partially daily-operational for MLB only**. It is not yet a complete daily multi-sport production prediction platform. NFL and NHL have Preview prediction evidence, while NBA, Soccer, BSN, Tennis and UFC remain blocked by data/source/canonical lifecycle gaps.

## Local Smoke Classification

Certification marker: `LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS`.

Two independent bounded PowerShell local-smoke wrappers exceeded their hard timeouts. This is classified as a Windows/PowerShell process-control problem, not proof that the application route is defective. Prior production and local smoke evidence already showed `/api/system/version` returning HTTP 200, and existing successful production evidence covers `/api/system/version`, dashboard, performance, operations and product routes.

This audit certification therefore relies on build, validators, artifact consistency, stored operational evidence and previously certified production smoke. A separate future smoke-harness repair may be created, but it is out of scope for this audit.

## Non-Server Validation

- JSON artifact validation: passed.
- Operational-readiness validator: passed.
- Changed-file ESLint: passed.
- `git diff --check`: passed.
- Secret scan: passed with no credential-like assignments found.
- `npm.cmd run build`: passed with 386 static pages.
- Local server smoke: not run.

## Pipeline

| Stage | Canonical service | Routes | Tables | Lifecycle |
| --- | --- | --- | --- | --- |
| Provider catalog | provider capability services and endpoint catalogs | /api/providers/*, /api/markets/* | sports_sync_jobs | MLB production, others partial/blocked |
| Sport schedule/events | historical import engine, identity materializer, sport sync services | /api/historical-import/*, /api/events/identity/*, sport sync routes | sport_events | non-MLB not production complete |
| Canonical identity | universal-event-identity and provider_entity_mappings | /api/events/identity/audit | provider_entity_mappings, sport_events | partial |
| Odds ingestion | SportsDataIO MLB and The Odds API ingestion scripts/services | /api/operations/adaptive-refresh, provider routes | sports_odds_snapshots, sports_sync_jobs | partial |
| Feature materialization | Feature Store Core and historical_feature_snapshots | /api/*/features/* | historical_feature_snapshots | partial |
| Prediction generation | sport prediction SDK and sport engines | /api/*/predictions* | prediction_history | partial |
| Current Board / AI Briefing | current-board, dashboard and AI operations services | /api/current-board, /api/dashboard, /api/ai-operations/* | prediction_history, odds snapshots | partial multi-sport |
| Result ingestion | MLB Stats API results path and The Odds API score-result scripts | /api/results/sync, /api/data-foundation/results-crosswalk | game_results, sport_events | partial |
| Settlement | operating-day settlement and settlement core/reconciliation | /api/operating-day/[id]/settle, /api/settlement/* | prediction_history | partial |
| Learning / Performance | ai-learning-lifecycle and performance services | /api/performance, /api/ai-operations/lifecycle | prediction_history, model_weight_history | partial |

## Sport Readiness

| Sport | Events | Results | Odds | Features | Predictions | Settlement | State | Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MLB | 4924 | 484 | 54289 | 72830 | 1242 | 1146 | PRODUCTION_READY | None for MLB core; still needs stronger multi-sport/5-10 minute operational cadence. |
| NBA | 14 | 0 | 540 | 47 | 27 | 27 | DATA_ONLY | Stored data is not enough for end-to-end production prediction, settlement and learning. |
| NFL | 75 | 0 | 1978 | 776 | 966 | 190 | PREVIEW_READY | Canonical result/settlement/learning loop and production promotion gates are not complete. |
| NHL | 32 | 0 | 426 | 258 | 258 | 0 | PREVIEW_READY | Canonical result/settlement/learning loop and production promotion gates are not complete. |
| Soccer | 0 | 0 | 260 | 0 | 0 | 0 | DATA_ONLY | Stored data is not enough for end-to-end production prediction, settlement and learning. |
| BSN | 38 | 2 | 0 | 0 | 8 | 8 | DATA_ONLY | Stored data is not enough for end-to-end production prediction, settlement and learning. |
| Tennis | 0 | 0 | 0 | 0 | 0 | 0 | UNAVAILABLE | No proven schedule/odds/result/prediction lifecycle. |
| UFC | 44 | 12 | 360 | 0 | 0 | 0 | DATA_ONLY | Stored data is not enough for end-to-end production prediction, settlement and learning. |

## Product Answer

- Can the platform operate daily now? MLB core only, not full multi-sport.
- Can each sport generate predictions now? MLB production, NFL/NHL preview, others blocked or data-only.
- Current and previous season coverage: MLB has current and previous season event coverage; non-MLB sports have partial, current-only or no previous-season coverage as recorded in `MULTI_SPORT_CURRENT_PREVIOUS_SEASON_COVERAGE_V1.json`.
- Was all available Odds API data downloaded? No. Current/previous-season, score/result, competition-scoped soccer and broad player-prop coverage remain incomplete or uncertified.
- Is 5-10 minute refresh feasible? MLB-only may be feasible after provider-budget confirmation; flat all-sport 5-minute polling is not certified. Adaptive refresh is recommended.
- Recommended refresh cadence: 60 minutes when more than 24 hours out, 15 minutes from 2-24 hours, 5-10 minutes under 2 hours, then stop pregame refresh after event start.
- Estimated calls/credits: MLB-only 10-minute refresh is 288 calls/day and 8640 credits/month; MLB-only 5-minute refresh is 576 calls/day and 17280 credits/month; all supported sports 10-minute refresh is 1728 calls/day and 51840 credits/month; all supported sports 5-minute refresh is 3456 calls/day and 103680 credits/month; adaptive supported-sport refresh is estimated at 1152 calls/day and 34560 credits/month before budget tuning.
- Result -> settlement -> learning -> Performance status: MLB has the production path with accumulating learning/performance evidence. NFL/NHL await deterministic finals before settlement/learning/promotion. NBA, Soccer, BSN, Tennis and UFC are not production-certified end to end.
- Does automatic model training occur? No.
- Were provider calls made during this audit? 0.

## Next Implementation Phases

1. Reliable daily MLB operation with bounded schedule, odds and result execution only when due.
2. Provider-budget-confirmed adaptive odds refresh, starting with MLB before broader sports.
3. Current/previous-season data completion plans by sport and provider.
4. NFL/NHL deterministic result ingestion, settlement and learning review after future games complete.
5. NBA, Soccer, BSN, Tennis and UFC source/canonical lifecycle repair before production prediction activation.
6. Separate local smoke-harness repair for Windows process-control reliability.

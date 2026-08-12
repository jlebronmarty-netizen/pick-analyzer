# Multi-Sport Handoff V1

Status: MULTI_SPORT_HANDOFF_READY_AFTER_MLB_FINAL

Date: 2026-08-11

Starting commit: `28c188cd1db7e131cedd4b38bc6642b5911d4d7b`

## Scope

This audit prepares the post-MLB multi-sport handoff. It does not activate a new sport, call providers, import history, create predictions, change provider authority, change scheduler configuration, change model formulas, or mutate production data.

MLB-FINAL-01 certifies MLB as the reference sport with full-game core historical replay complete and unsupported markets kept forward-only. No new sport is started by this handoff update.

MLB remains the reference architecture:

- Odds: The Odds API, `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT`.
- Non-odds: MLB Official, `MLB_OFFICIAL_PRIMARY`.
- SportsDataIO: rollback-only, routine MLB calls 0.
- Product safety: exact-line, freshness-aware, fail-closed Current Board.
- Prediction safety: pregame, cutoff-safe, Current Era isolated.
- Settlement and learning: canonical result identity, deterministic closure.
- Operations: coverage-aware health; partial fail-closed loss is degraded, not a systemic outage.

## Sport Registry Audit

| Sport | Sport Key | League Key | Enabled | Production Enabled | Overall |
| --- | --- | --- | --- | --- | --- |
| NBA | `basketball_nba` | `nba` | yes | no | PARTIAL |
| NFL | `americanfootball_nfl` | `nfl` | yes | no | FOUNDATION |
| NHL | `icehockey_nhl` | `nhl` | yes | no | FOUNDATION |
| Soccer | `soccer` | `soccer_generic` | yes | no | FOUNDATION |
| Tennis | `tennis` | `atp`, `wta` | yes | no | MINIMAL |
| UFC | `mma_ufc` | `ufc` | yes | no | MINIMAL |
| BSN | `basketball_bsn` | `bsn_pr` | yes | no | PARTIAL |

All seven sports are registered in `src/config/sports.config.ts`. Only MLB is currently production-ready.

## Repository Service Inventory

| Sport | Actual Services And Routes | Maturity |
| --- | --- | --- |
| NBA | `nba-data-sync.service.ts`, `nba-prediction-engine.service.ts`, `nba-prediction-validation.service.ts`, `nba-prediction-settlement.service.ts`, `nba-backtesting-calibration.service.ts`, `nba-feature-store-integration.service.ts`, `/api/nba/*`, `/api/data-foundation/nba` | Substantial but not production-certified |
| NFL | `nfl-feature-store-integration.service.ts`, `nfl-prediction-engine.service.ts`, `/api/nfl/features/*`, `/api/nfl/predictions/*`, `/api/data-foundation/nfl` | Provider-independent preview |
| NHL | `nhl-feature-store-integration.service.ts`, `nhl-prediction-engine.service.ts`, `/api/nhl/features/*`, `/api/nhl/predictions/*`, `/api/data-foundation/nhl` | Provider-independent preview |
| Soccer | `soccer-feature-store-integration.service.ts`, `soccer-prediction-engine.service.ts`, `/api/soccer/features/*`, `/api/soccer/predictions/*`, `/api/data-foundation/soccer` | Provider-independent preview with competition complexity |
| Tennis | `tennis-feature-store-integration.service.ts`, `tennis-prediction-engine.service.ts`, `tennis-ufc-data-readiness-v2.service.ts`, `/api/tennis/*`, `/api/data-foundation/tennis-ufc` | Preview only |
| UFC | `ufc-feature-store-integration.service.ts`, `ufc-prediction-engine.service.ts`, `tennis-ufc-data-readiness-v2.service.ts`, `/api/ufc/*`, `/api/data-foundation/tennis-ufc` | Preview only |
| BSN | `basketball-source-framework.service.ts`, `bsn-platform.service.ts`, `bsn-historical-foundation-v2.service.ts`, `bsn-shadow-prediction-engine.service.ts`, `bsn-core-certification.service.ts`, `/api/bsn/*`, `/api/basketball/bsn/*` | Source-blocked custom foundation |

## Database And Historical Inventory

Read-only foundation endpoints were used where available. Provider calls were 0 and remote mutations were 0.

| Sport | Historical State | Certification Notes |
| --- | --- | --- |
| NBA | HISTORICAL_FOUNDATION_PARTIAL | `/api/data-foundation/nba` reports schedule, team identity, player identity, quarter score, boxscore, injury, lineup and odds coverage true, but no-temporal-leakage false and trial isolation is preserved. Stored prediction rows are trial/non-production. |
| NFL | CURRENT_ONLY / PARTIAL_REPLAY | `/api/data-foundation/nfl` reports schedule and odds coverage true, but team identity, player identity, standings, game stats, quarter scores, injuries and depth/starter coverage false. |
| NHL | CURRENT_ONLY / PARTIAL_REPLAY | `/api/data-foundation/nhl` reports schedule and odds coverage true plus cross-year season model true, but team/player identity, standings, period scores, boxscores, goalie starters and injuries false. |
| Soccer | NO_MEANINGFUL_HISTORY | `/api/data-foundation/soccer` reports odds coverage true but fixture/result/stat/lineup coverage false and requires competition-specific governance. |
| Tennis | NO_MEANINGFUL_HISTORY | `/api/data-foundation/tennis-ufc` reports tennis event, participant, result/stat, odds and mapping blockers. |
| UFC | NO_MEANINGFUL_HISTORY | `/api/data-foundation/tennis-ufc` reports UFC participant and result/stat blockers. |
| BSN | HISTORICAL_FOUNDATION_PARTIAL | `/api/data-foundation/bsn` reports custom adapter, CSV readiness, identity governance and reconstruction contracts, but approved source is required. |

## Official And Free Source Matrix

No source was live-tested in this phase.

| Sport | Schedule/Status/Results | Teams/Players/Stats | Historical | Classification |
| --- | --- | --- | --- | --- |
| NBA | NBA official stats ecosystem is the target, but repository certification is pending. The Odds API scores can provide limited recent results. | Existing NBA services model players, injuries and lineups, but source replacement/certification is required. | Existing stored/trial evidence plus future NBA official/free reconstruction. | EXISTING_NOT_CERTIFIED |
| NFL | Official/free source requires research; existing foundation has schedule only. | nflverse/open data may be a historical candidate, but repository support is not certified. | Research/import required. | RESEARCH_REQUIRED |
| NHL | NHL official public API is a strong candidate for schedule/status/results/players/stats. | Goalie/injury/special-teams source certification required. | Research/import required. | RESEARCH_REQUIRED |
| Soccer | Must be competition-specific; one global source is unsafe. | League-specific official/free sources vary. | Competition-by-competition plan required. | RESEARCH_REQUIRED |
| Tennis | ATP/WTA official data access and free historical datasets require certification. | Player rankings, surface and match data require source proof. | Research/import required. | RESEARCH_REQUIRED |
| UFC | Official event/bout result data may be human-readable but API/source stability is unproven. | Fighter records/method/round data require source proof. | Research/import required. | RESEARCH_REQUIRED |
| BSN | Existing official-homepage connector and CSV contracts exist, but production source approval is required. | Team/player/boxscore depth requires approved feed or attested files. | Approved CSV/source required. | EXISTING_NOT_CERTIFIED |

## Paid Provider Dependency Audit

| Sport | Dependency | Runtime? | Required? | Replacement Target |
| --- | --- | --- | --- | --- |
| NBA | SportsDataIO NBA trial/readiness services and docs | not production active | no for next architecture | NBA official/free source plus The Odds API |
| NFL | SportsDataIO catalog/docs | not production active | no | official/free/open football source plus The Odds API |
| NHL | SportsDataIO catalog/docs | not production active | no | NHL official API plus The Odds API |
| Soccer | SportsDataIO catalog/docs | not production active | no | competition official/free sources plus The Odds API |
| Tennis | none required by current preview | no | no | ATP/WTA/free historical source plus The Odds API |
| UFC | none required by current preview | no | no | UFC official/free source plus The Odds API |
| BSN | none certified for odds; source approval blocker | no | no paid dependency approved | approved BSN source or attested CSV |

## The Odds API Coverage

This is based on repository contracts and prior certification only. No provider call was made.

| Sport | Core Odds Status | Core Markets |
| --- | --- | --- |
| NBA | CORE_ODDS_IMPLEMENTED_NOT_CERTIFIED | ML / Spread / Total |
| NFL | SUPPORTED_PROVIDER_NOT_INTEGRATED | ML / Spread / Total |
| NHL | SUPPORTED_PROVIDER_NOT_INTEGRATED | ML / Puck Line / Total |
| Soccer | SUPPORTED_PROVIDER_NOT_INTEGRATED | H2H including draw, spreads/totals where supported by competition |
| Tennis | UNKNOWN_REQUIRES_BOUNDED_TEST | H2H first; other markets only if evidence-supported |
| UFC | UNKNOWN_REQUIRES_BOUNDED_TEST | H2H first; method/round only after evidence-supported settlement |
| BSN | UNKNOWN_REQUIRES_BOUNDED_TEST | Only evidence-supported markets; do not assume support |

## Maturity Summary

| Sport | Feature Store | Prediction Engine | Settlement | Learning | Replay Feasibility | Current Era |
| --- | --- | --- | --- | --- | --- | --- |
| NBA | FEATURE_STORE_PARTIAL | ENGINE_IMPLEMENTED_NEEDS_CERTIFICATION | PARTIAL | PARTIAL | MODEL_REPLAY_READY_NO_PRICES | CURRENT_ERA_PARTIAL |
| NFL | FEATURE_STORE_PARTIAL | ENGINE_PARTIAL | MISSING | MISSING | PARTIAL_REPLAY | OFFSEASON_READY_FOR_PREP |
| NHL | FEATURE_STORE_PARTIAL | ENGINE_PARTIAL | MISSING | MISSING | PARTIAL_REPLAY | OFFSEASON_READY_FOR_PREP |
| Soccer | FEATURE_STORE_PARTIAL | ENGINE_PARTIAL | MISSING | MISSING | BLOCKED_LEAKAGE_RISK | CURRENT_ERA_PARTIAL |
| Tennis | FEATURE_STORE_PARTIAL | ENGINE_PARTIAL | MISSING | MISSING | BLOCKED_NO_HISTORY | CURRENT_ERA_PARTIAL |
| UFC | FEATURE_STORE_PARTIAL | ENGINE_PARTIAL | PARTIAL moneyline contract only | MISSING | BLOCKED_NO_HISTORY | CURRENT_ERA_PARTIAL |
| BSN | FEATURE_STORE_PARTIAL | ENGINE_IMPLEMENTED_NEEDS_CERTIFICATION | PARTIAL shadow only | PARTIAL | PARTIAL_REPLAY | CURRENT_ERA_PARTIAL |

## Priority Scoring

Weights: repository maturity 20, historical readiness 20, official/free source quality 15, prediction engine 15, settlement/learning 10, The Odds API core support 10, season timing 5, implementation complexity 5.

| Rank | Sport | Repo | History | Source | Engine | Settlement | Odds | Timing | Complexity | Total | Advantage | Blocker |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1 | NBA | 18 | 14 | 11 | 14 | 8 | 9 | 3 | 4 | 81 | Most complete existing architecture | SportsDataIO/trial lineage and official-source certification |
| 2 | BSN | 14 | 12 | 6 | 12 | 6 | 2 | 4 | 3 | 59 | Custom framework and source governance already built | Approved source and odds coverage missing |
| 3 | NFL | 11 | 8 | 8 | 10 | 3 | 9 | 5 | 4 | 58 | High product value and core The Odds API support | Sparse canonical history/features |
| 4 | NHL | 10 | 8 | 10 | 9 | 3 | 9 | 3 | 4 | 56 | Official API candidate and simple core markets | Goalie/stats/history gaps |
| 5 | Soccer | 9 | 4 | 6 | 9 | 2 | 8 | 5 | 1 | 44 | Active calendar and rich market potential | Competition identity and draw/settlement complexity |
| 6 | UFC | 8 | 3 | 5 | 8 | 3 | 6 | 4 | 2 | 39 | Event cadence and H2H simplicity | Fighter/result/history source gaps |
| 7 | Tennis | 8 | 3 | 5 | 8 | 2 | 6 | 5 | 2 | 39 | Active calendar and H2H simplicity | Participant/ranking/surface/history gaps |

## Next Sport

NEXT_SPORT: NBA

NBA wins because it has the most end-to-end repository foundation: sync services, feature-store integration, prediction engine, validation, settlement, backtesting/calibration, data-quality routes, multi-book/steam surfaces, and historical foundation reporting. The next work should reuse this architecture and certify/repair it against the MLB lessons rather than recreating it.

## NBA Action Matrix

| Domain | Current State | Target State | Action |
| --- | --- | --- | --- |
| Sport registry | Registered, enabled, not production-ready | Same registration with certified readiness gates | REUSE_WITH_CERTIFICATION |
| Teams | Canonical list/service exists | Certified NBA team identity and aliases | REUSE_WITH_CERTIFICATION |
| Players | Partial/player-stat based | Certified player identity source | REPAIR |
| Events/schedule | Existing sync + historical foundation | Official/free schedule/status contract | REPAIR |
| Results | Existing settlement reads final scores | Official/free result identity | REPAIR |
| Stats | Derived/team stats and player-stat services | Pregame-safe team/player stats | EXTEND |
| Injuries/lineups | Existing contracts, source-dependent | Certified source or fail-closed blocker | REPAIR |
| Historical data | Partial/trial/non-production evidence | Leakage-safe historical foundation | EXTEND |
| Feature store | Integration exists | Durable pregame feature snapshots | EXTEND |
| Odds | The Odds API provider key configured | MLB-style exact-line primary odds | EXTEND |
| Prediction engine | Implemented | Cutoff-safe persisted Current Era candidates | REUSE_WITH_CERTIFICATION |
| Calibration | Backtest/calibration exists | Shadow-only out-of-sample calibration | REUSE_WITH_CERTIFICATION |
| Settlement | Implemented for core/first-half | Certified current-era settlement | REUSE_WITH_CERTIFICATION |
| Learning | Partial through settlement evidence | Deduped learning labels | EXTEND |
| Current Board | Generic support only | NBA exact-line/freshness/fail-closed board | EXTEND |
| Performance | Existing NBA performance route | Current Era default, replay isolated | EXTEND |
| Scheduler | NBA sync cron exists historically | Vercel primary protected scheduler integration | REPAIR |
| Health/provider budget | Generic services exist | Coverage-aware NBA operations health | EXTEND |

## NBA Provider Map

| Domain | Target |
| --- | --- |
| Odds | The Odds API, exact-line, certified books after bounded test authorization |
| Schedule | NBA official/free source, certification required |
| Status | NBA official/free source, certification required |
| Results | NBA official/free source, same canonical event identity |
| Teams | Existing canonical NBA teams plus source crosswalk |
| Players | NBA official/free source or approved open dataset, certification required |
| Team Stats | Derived from canonical results/boxscores where possible |
| Player Stats | Official/free boxscore/player game source, certification required |
| Lineups/Starters | Injury/lineup source only after approval; fail closed otherwise |
| Historical | Existing stored/trial evidence plus official/free historical reconstruction |
| Fallback | Config-only rollback to previous NBA provider contracts, no hidden paid fallback |

Paid provider dependency: not required for planned NBA core activation. Any future paid source requires explicit authorization.

## NBA Historical Strategy

Target seasons: 2024-25 completed season plus 2025-26/current safe window for architecture proof; expand only after source certification.

Expected scale for one NBA season:

- Events/results: about 1,230 regular-season games plus playoffs.
- Team-game rows: about 2,460 regular-season rows plus playoffs.
- Player-game rows: roughly 25,000 to 35,000 depending active roster/depth.
- Feature snapshots: one per event-market-version candidate.
- Replay predictions: ML / Spread / Total first; first-half only after period data is certified.
- Historical prices: only if legitimate historical odds exist; otherwise model replay only.

Replay type: MODEL_REPLAY_READY_NO_PRICES initially. PRICE_AWARE_REPLAY requires legitimate pregame historical price evidence.

Leakage safety: feature snapshots must be generated from pre-cutoff evidence only; no final score, postgame stat, future aggregate, or post-start lineup information can enter pregame features.

## Operations Posture

`operationsProductionReady` remains a global operational posture, not a next-sport preparation blocker. It can block production activation if any sport-specific operation is unsafe, but NBA foundation work can proceed in preview/shadow mode.

Classification: NON_BLOCKING_POSTURE_FOR_PREPARATION.

NBA must inherit:

- Coverage-aware health semantics.
- Fail-closed Current Board states.
- Exact-line price binding.
- No hidden provider fallback.
- Provider call/credit accounting.
- Scheduler primary/fallback separation.
- Settlement closure independence from market freshness.

## MLB Rollback Window Monitor

Rollback Day 1: 2026-08-11

Current read-only evidence:

- SportsDataIO MLB routine calls: 0
- The Odds API health: HEALTHY
- MLB Official health: HEALTHY
- Current Board: READY
- Scheduler: HEALTHY
- Settlement: PASS

Clean days completed: 0 full days completed as of 2026-08-11.

Clean days remaining: 3.

SportsDataIO MLB cancellation readiness: NOT_YET. Do not cancel automatically.

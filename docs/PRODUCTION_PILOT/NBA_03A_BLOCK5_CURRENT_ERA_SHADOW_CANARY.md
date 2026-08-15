# NBA-03A Block 5 Current Era Shadow Canary

Status: `NBA_03A_BLOCK5_SAFE_CANARY_CERTIFIED_WAITING_FOR_CURRENT_DATA`

## Purpose

`NBA_CURRENT_ERA_SHADOW_CANARY_V1` is the bounded mechanism that will eventually create the first legitimate NBA `CURRENT_ERA_SHADOW` prediction row. It does not activate NBA production, Official Picks, user-facing recommendations, bankroll execution, notifications, learning promotion or calibration promotion.

The correct result while no legitimate future NBA slate is stored is a deterministic dry-run no-op.

## Root Cause

The existing `/api/nba/predictions/generate` path reuses the normal NBA prediction engine and persistence flow, but that path is not safe for first Current Era Shadow rows because it can:

- use `-110` when no stored odds row exists;
- use default spread or total lines when no current market row exists;
- create first-half output from projected split without provider first-half odds;
- persist without `prediction_origin = CURRENT_ERA_SHADOW` and shadow-only certification metadata.

Historical replay behavior was not changed. Historical replay remains historical.

## Safe Canary Architecture

New bounded component:

- `src/services/nba-current-era-shadow-canary.service.ts`

New operational dry-run entry point:

- `scripts/nba-03a-current-era-shadow-canary.mjs`

New validator:

- `scripts/nba-03a-current-era-shadow-canary-validate.mjs`

The canary reuses the existing `prediction_history` persistence primitive only after stricter Current Era gates pass. It does not create a second prediction engine and does not call any provider.

## Eligibility Contract

Current Era Shadow persistence requires:

- `sport_key = basketball_nba`;
- canonical NBA event;
- pregame event status;
- generated before the ten-minute cutoff;
- real stored odds evidence;
- odds provider `the-odds-api`;
- exact price and timestamp;
- odds no older than the bounded canary freshness threshold;
- supported market: moneyline, spread or total;
- exact line for non-moneyline markets;
- no historical trial or scrambled evidence;
- no duplicate logical prediction for event, market, selection, line, sportsbook, origin and model version;
- `prediction_origin = CURRENT_ERA_SHADOW`;
- `recommended_pick = false`;
- `production_eligible = false`;
- `certification_status = SHADOW_PENDING`;
- certification metadata marking product, Official Pick, learning and calibration eligibility as false.

## Forbidden Fallbacks

Current Era Shadow blocks:

- fake `-110`;
- zero odds;
- default odds;
- synthetic lines or prices;
- default spread/total lines;
- historical SportsDataIO trial/scrambled odds;
- post-start odds;
- model-only null-odds persistence.

Historical replay fallbacks are preserved only for historical replay certification paths.

## Production Dry-Run Result

Current stored state remains compatible with a safe zero-row result:

- future NBA events: 0
- candidates: 0
- eligible: 0
- skip reason: `NO_CURRENT_EVENT`
- provider calls: 0
- database mutations from dry-run: 0
- `CURRENT_ERA_SHADOW` before: 0
- inserts: 0
- reused: 0
- `CURRENT_ERA_SHADOW` after: 0
- duplicate logical predictions: 0

## Isolation

- NBA Official Pick delta: 0
- product visibility delta: 0
- alert delta: 0
- production learning delta: 0
- production calibration delta: 0
- historical replay mutation delta: 0
- MLB mutation delta: 0

## Provider Authority

NBA odds authority target is The Odds API using stored `sports_odds_snapshots.provider = the-odds-api`.

Forward schedule/status/results authority is not silently chosen in this phase. The prior architecture identifies BallDontLie or an official/free candidate as possible non-odds forward authority. That schedule authority remains unresolved for live sync.

SportsDataIO NBA rows remain legacy/trial-only and are not acceptable Current Era evidence.

## Next Step

The smallest next NBA-03A step is a bounded current NBA schedule and The Odds API price-sync authorization that creates legitimate future stored events and current timestamped odds evidence. The first live `CURRENT_ERA_SHADOW` write should remain a separate explicit authorization after those inputs exist.

# NBA-03A Block 5 Current Era Shadow Canary

Status: `NBA_03A_BLOCK5_SINGLE_CANDIDATE_WRITER_CERTIFIED_READY_FOR_FIRST_SHADOW`

## Purpose

`NBA_CURRENT_ERA_SHADOW_CANARY_V1` is the bounded mechanism that will eventually create the first legitimate NBA `CURRENT_ERA_SHADOW` prediction row. It does not activate NBA production, Official Picks, user-facing recommendations, bankroll execution, notifications, learning promotion or calibration promotion.

The correct result after the current-data sync is a deterministic dry-run that exposes stable candidate keys and proves which candidates are price-eligible, model-matched and write-eligible without creating a real `CURRENT_ERA_SHADOW` row.

## Root Cause

The existing `/api/nba/predictions/generate` path reuses the normal NBA prediction engine and persistence flow, but that path is not safe for first Current Era Shadow rows because it can:

- use `-110` when no stored odds row exists;
- use default spread or total lines when no current market row exists;
- create first-half output from projected split without provider first-half odds;
- persist without `prediction_origin = CURRENT_ERA_SHADOW` and shadow-only certification metadata.

The subsequent current-data sync exposed two follow-up blockers: generic write mode could persist every eligible candidate, and model matching incorrectly required sportsbook identity even though sportsbook belongs to price evidence rather than the canonical model prediction identity.

Historical replay behavior was not changed. Historical replay remains historical.

## Safe Canary Architecture

New bounded component:

- `src/services/nba-current-era-shadow-canary.service.ts`

New operational dry-run entry point:

- `scripts/nba-03a-current-era-shadow-canary.mjs`

New validator:

- `scripts/nba-03a-current-era-shadow-canary-validate.mjs`

The canary reuses the existing `prediction_history` persistence primitive only after stricter Current Era gates pass. It does not create a second prediction engine and does not call any provider.

## Single-Candidate Writer Repair

The certified write interface is now `write-one`, not a broad write mode. It requires:

- `NBA_CURRENT_ERA_SHADOW_WRITE_AUTHORIZED=true`;
- `--candidate-key=<stable dry-run candidate key>`;
- exactly one matching write-eligible candidate;
- a real canonical NBA model output for the same event, market, selection and exact line;
- real stored sportsbook price evidence for the selected provider/book/odds row.

If zero or multiple candidates match the selector, persistence refuses with `WRITE_CARDINALITY_NOT_ONE`. The system never truncates an ambiguous selection to the first row.

## Identity Contract

Canonical model prediction identity:

- sport
- event
- market
- selection
- exact line
- model version

Price evidence identity:

- provider
- sportsbook
- odds
- odds snapshot ID
- provider/source timestamp
- snapshot capture time

Persisted logical prediction identity:

- sport
- event
- market
- selection
- exact line
- sportsbook
- prediction origin
- model version

Sportsbook and odds are therefore attached evidence for the selected candidate. They are not required for canonical model-output matching, but they remain part of the persisted row and duplicate/idempotency gate.

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

A real sportsbook quote of `-110` is allowed when it has The Odds API provenance and a real timestamp. A missing-timestamp/default `-110` remains blocked as `INVALID_ODDS_VALUE` plus `MISSING_REAL_ODDS`.

## Production Dry-Run Result

Current stored state now has real forward NBA events and odds, but the canary remains dry-run only:

- future NBA events scanned: 25
- price candidates: 362
- price eligible: 362
- model matched: 133
- write eligible: 133
- skipped: 229
- skip reason: `MODEL_OUTPUT_MISSING`
- provider calls: 0
- database mutations from dry-run: 0
- `CURRENT_ERA_SHADOW` before: 0
- inserts: 0
- reused: 0
- `CURRENT_ERA_SHADOW` after: 0
- duplicate logical predictions: 0

First deterministic write-eligible candidate key:

`basketball_nba|26b036ff107f3c658258eaf4a6f26228|spread|detroit_pistons|-2|betonline.ag|26b036ff107f3c658258eaf4a6f26228_betonline_ag_spread_detroit_pistons_110_2_2026_08_15t02_10`

Candidate evidence:

- event ID: `26b036ff107f3c658258eaf4a6f26228`
- market: spread
- selection: Detroit Pistons
- line: -2
- sportsbook: BetOnline.ag
- odds: -110
- odds timestamp: 2026-08-15T02:10:56+00:00
- price age: 26 minutes

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

Forward schedule/status/results authority is not changed in this phase.

SportsDataIO NBA rows remain legacy/trial-only and are not acceptable Current Era evidence.

## Next Step

Publish this repair first. The next operational step is a separate explicit authorization for exactly one real `CURRENT_ERA_SHADOW` write using a dry-run candidate key.

# Best Bets Today - Official And Informational Selection Engine V1

Implemented on 2026-07-17.

## Purpose

Best Bets Today ranks every valid supported current MLB wager from the canonical Current Board and answers the product question: should a user bet today?

The engine has two modes:

- `BEST BETS TODAY`: at least one candidate passed existing official gates.
- `BEST BETS TODAY - NOT RECOMMENDED`: no candidate passed official gates, so the response is informational only and shows the strongest current options with blockers.

## Inputs

The engine consumes stored Current Board candidates only. It makes zero provider calls and performs zero remote mutations.

Inputs include:

- model probability and calibrated probability when available
- sportsbook implied probability
- edge and expected value
- confidence and reliability
- feature quality, data sufficiency and critical input completeness
- verified starter confidence, pitching mismatch, weather, wind and StadiumID context when attached
- odds freshness, line validity and anomaly flags
- recommendation policy status, official eligibility, blockers and missing information

## Ranking Contract

The score is deterministic and balances probability, value, confidence, data quality, starter/pitching context, market freshness and reliability. Negative EV, non-positive edge, stale odds, limited critical inputs, calibration blockers and official-policy blockers reduce rank.

Probability alone cannot make a Best Bet. EV alone cannot make a Best Bet. Informational selections are never labeled official.

## API Surface

- `GET /api/best-bets-today`
- `GET /api/best-bets-today?includeValidation=true`
- `GET /api/current-board` now includes `bestBetsToday`
- `GET /api/predictions/top` now includes `bestBetsToday`

All responses report:

- `providerCallsMade: 0`
- `remoteMutationsMade: 0`
- `officialHistoryChanged: false`
- `predictionsRegenerated: false`
- `predictionRegenerationNote`

## Current-Slate Regeneration Decision

No current-slate regeneration path was invoked in this patch. The safe persisted path for regenerating only current MLB pregame predictions without broader historical side effects was not obvious enough to run autonomously. Best Bets Today therefore ranks the already enriched Current Board, which now carries the corrected V5 starter/weather/stadium context from stored evidence.

## Dashboard And Coach

The Today dashboard Top Picks panel now shows a prominent Best Bets Today section above the legacy official-only Top Picks columns. When official picks remain off, the section says `BEST BETS TODAY - NOT RECOMMENDED` and displays blockers.

The deterministic MLB AI Coach now answers best-bet/top-pick/should-I-bet questions from this same contract.

## Guardrails

This module does not:

- change recommendation thresholds
- promote production eligibility
- alter official history
- regenerate Current Board or predictions
- run settlement
- fabricate missing data
- call SportsDataIO or any other provider

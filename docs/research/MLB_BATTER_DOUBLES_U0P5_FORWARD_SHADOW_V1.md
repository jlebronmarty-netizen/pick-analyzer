# MLB Batter Doubles U0.5 Forward Shadow V1

Status: RESEARCH-ONLY / FORWARD-ONLY

## Exact contract

- Market: Batter Doubles
- Exact line: 0.5
- Side: UNDER
- Threshold: projection <=0.16
- Minimum prior games: 10
- Historical accuracy: 86.93%
- Source: `mlb_statcast_batter_sdt_game_mv`

Projection uses the certified runtime refit:
`max(0, 0.126877618354346 + 0.210234641434428 * ((recent_PA/10) * (prior_doubles/prior_PA)))`.

## 2026-09-24 audit

The exact U0.5 market was captured for PIT-STL.

Using the runtime formula, 12 players qualified:
- Bryan Torres
- Henry Davis
- JJ Wetherholt
- Spencer Horwitz
- Ronny Simon
- Thomas Saggese
- Masyn Winn
- Nathan Church
- Oneil Cruz
- Iván Herrera
- Ryan O'Hearn
- Jake Mangum

Captured best prices for these qualifiers were extremely expensive, roughly -600 to -830.

Therefore this market is operationally available and model-evaluable, but price quality may make many crossings unattractive as real standalone bets.

No EV is calculated because the model does not expose a calibrated per-play probability.

## Forward protocol

A SHADOW_CANDIDATE requires:
1. exact strict-pregame U0.5 quote;
2. exact MLBAM identity;
3. >=10 strict-prior games;
4. runtime projection <=0.16.

No target-day `pick2_mlb_batter_daily_features` row is required for Doubles.

## Boundaries

- no line extrapolation
- no threshold retuning
- no fuzzy matching
- strict-pregame only
- no historical Odds API spend
- Official Picks unchanged
- APOSTAR disabled
- no production promotion

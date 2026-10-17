# PA-13 — Historical Pitcher Earned Runs Pricing Audit

Date: 2026-09-15

Verdict: `HISTORICAL_PITCHER_ER_PRICING=ABSENT`

## Scope audited

Read-only production audit covered the persisted odds/market surfaces currently available in Pick Analyzer:

- `sports_odds_snapshots` — 1,487,666 rows;
- `pick2_mlb_market_price_observations` — 7,506 rows;
- `pick2_mlb_market_value_evaluations` — 7,400 rows;
- `pick2_mlb_market_event_mappings` — 88 rows;
- legacy `odds` — 0 rows;
- legacy `pick2_market_value_evaluations` — 0 rows.

The audit searched market keys, market names, outcomes, metadata/provenance JSON, mapping evidence, and legacy raw odds payloads for persisted Earned Runs pricing evidence.

## Result

Stored matches for `earned` / Pitcher Earned Runs pricing: **0** across all audited persisted pricing surfaces.

Pitcher-related persisted market evidence found in `sports_odds_snapshots` is limited to:

- `player_props:pitcher_outs_recorded` — 11 rows;
- `pitcher_strikeouts` — 1 row.

`pick2_mlb_market_price_observations` currently contains game-market observations rather than a historical Pitcher Earned Runs price history.

## PA-13 gate

Because no historical sportsbook Pitcher Earned Runs line/price surface is persisted, PA-13 must remain fail-closed for sportsbook ROI/backtest claims:

- historical Pitcher ER ROI: **NOT COMPUTABLE**;
- historical closing-line value: **NOT COMPUTABLE**;
- price-aware EV calibration: **NOT COMPUTABLE**;
- no synthetic price history may be created to fill the gap.

Point-model and probability diagnostics may continue as research, but accuracy/Brier evidence must not be described as historical betting ROI.

## Safety

This audit used stored data only. It made no sportsbook/provider calls, consumed no odds-provider credits, performed no DML/DDL, wrote no Official Picks, and did not activate APOSTAR or any production betting path.

# MLB Exact-Line Forward Shadow V1

Status: **RESEARCH-ONLY / FORWARD-ONLY**

This runtime turns the previously read-only exact-line Pitcher K / Pitcher Outs research
contracts into immutable daily forward rows.

## Persisted contracts

- Pitcher K O3.5: projection >= 4.25.
- Pitcher K U7.5: projection <= 5.50.
- Pitcher K U8.5: projection <= 4.75.
- Pitcher Outs O13.5: projection >= 16.00.
- Pitcher Outs O14.5: projection >= 15.75.

Pitcher K U6.5 is intentionally not duplicated here because its exact-line candidate is already
persisted through the approved-prop daily board.

## Selection

Selection is independent of price.

A row can freeze only when:
- exact market exists;
- exact numerical line exists;
- exact OVER/UNDER side exists;
- exact gamePk exists;
- exact MLBAM pitcher identity exists;
- quote is strictly pregame;
- at least five strict-prior starts exist;
- frozen projection crosses the frozen threshold.

`YES` milestone outcomes are not silently treated as `OVER`; exact OVER/UNDER semantics are required.

## Projection formulas

Pitcher K:
`0.60 * (prior K/BF * L5 BF/start) + 0.40 * L5 K/start`

Pitcher Outs:
`0.50 * season-to-date outs/start + 0.50 * L5 outs/start`

No target-date or postgame history may enter the projection.

## Quotes

All exact pregame quotes are retained.

Display quote policy:
1. FanDuel when available;
2. otherwise highest American price among exact quotes.

This policy affects display/provenance only, never model qualification.

## Settlement

Settlement uses:
`public.mlb_ml_xyear_pitcher_game_v1`

Identity:
- exact gamePk;
- exact MLBAM pitcher id.

Actual strikeouts or outs are compared to the frozen exact line/direction.
No outcome is inferred from another game or player.

## Postseason

R/F/D/L/W targets are allowed after the postseason compatibility repair.

Every postseason row is labeled:
`POSTSEASON_SHADOW_DOMAIN_SHIFT`

Postseason results remain separate from regular-season forward evidence.

## Boundaries

- no formulas or thresholds change;
- no line extrapolation;
- no side substitution;
- historical accuracy is not a per-play probability;
- no Official Picks;
- APOSTAR off;
- no production promotion;
- no historical Odds API spend.

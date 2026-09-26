# MLB Moneyline Opening Consensus — 2026 External Backfill V1

Status: **RESEARCH-ONLY / EXTERNAL-ONLY / PREPARED, NOT EXECUTED**

This backfill exists only to evaluate the already-frozen 2025 Moneyline candidate from PR #237.

The candidate was frozen before any 2026 opening-market data was acquired for this test.

## Frozen formula

- BALLDONTLIE opening Moneyline
- vendors: BetMGM + BetRivers only
- two-book no-vig consensus favorite probability >=0.65
- all 6/6 fundamentals must favor the same side
- HOME and AWAY both eligible
- no retuning allowed

## 2026 universe

`mlb_ml_xyear_features_v1`:
- 2,402 settled games
- 182 game dates
- 2026-03-25 through 2026-09-25
- 2,078 games already have all six required fundamentals populated

## Acquisition

BALLDONTLIE:
- games endpoint for exact game identity
- opening odds endpoint
- only BetMGM and BetRivers Moneyline pairs are persisted

Dedicated research table:

`public.mlb_bdl_opening_ml_2026_external_v1`

RLS is enabled and public roles have no access.

Each invocation processes at most 8 dates and checkpoints completed dates in `sports_sync_jobs`.

## Identity

Provider games are normalized only with deterministic aliases:
- ARI -> AZ
- CHW -> CWS
- WSN/WAS -> WSH
- TBR -> TB
- OAK -> ATH

Single games map by exact date/home/away pair.

Doubleheaders are mapped only if provider scheduled-time groups and xyear game counts agree. Otherwise the pair fails closed.

No fuzzy matching.

## External rule

Once this backfill is executed:
- the frozen 0.65 threshold cannot change;
- the 6/6 fundamental requirement cannot change;
- vendor set cannot change;
- HOME/AWAY eligibility cannot change;
- feature definitions cannot change.

No historical Odds API spend.

## Frozen external scoring SQL

Before the 2026 acquisition is executed, the exact external scoring query is frozen at:

`scripts/research/mlb_ml_opening_consensus_2026_external_score.sql`

It requires:
- BetMGM + BetRivers both present;
- the same American-odds no-vig formula;
- consensus favorite probability >=0.65;
- exactly 6/6 fundamentals aligned;
- 2026 xyear feature row joined by the persisted xyear canonical game ID;
- no missing required features.

The query is SELECT-only.

Runner trigger marker after PR #238 merge.

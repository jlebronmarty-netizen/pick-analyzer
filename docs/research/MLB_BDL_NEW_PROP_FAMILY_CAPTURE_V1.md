# MLB BALLDONTLIE New Prop Family Capture V1

Status: **RESEARCH-ONLY / PROSPECTIVE CAPTURE**

## Why this exists

The current BALLDONTLIE fallback already requests the complete simplified MLB player-props response, but the local map only retained the older approved families.

BALLDONTLIE documents additional compatible MLB player-prop types that can arrive in the same response. This branch preserves those rows prospectively instead of silently discarding them.

## New canonical mappings

| BALLDONTLIE prop_type | Canonical research market | Outcome-data readiness |
|---|---|---|
| stolen_bases | batter_stolen_bases | ready |
| runs_scored | batter_runs | ready |
| runs_rbis | batter_runs_rbis | ready |
| hits_runs_stolen_bases | batter_hits_runs_stolen_bases | ready |
| hits_stolen_bases | batter_hits_stolen_bases | ready |
| hits_walks_stolen_bases | batter_hits_walks_stolen_bases | ready |
| extra_base_hits | batter_extra_base_hits | ready |
| first_home_run | batter_first_home_run | needs play-by-play ordering |

Ready means the underlying outcome components exist in exact historical/postgame sources. It does not mean a 75% model exists.

## Provider discovery guard

BALLDONTLIE documents prop_type as open-ended. The capture now records observedPropTypes and unmappedPropTypes in the research sync job metadata.
Each mapped snapshot also retains providerPropType and providerMarketType.

## Cost boundary

This change does not add anything to The Odds API REQUEST_MARKETS. New rows come only from the BALLDONTLIE fallback response already being fetched prospectively.

## Research order after first real capture

1. Runs scored.
2. Runs + RBIs.
3. Extra-base hits.
4. Stolen bases.
5. Combined hit/run/SB families.
6. First home run only after exact first-HR settlement lineage exists.

Market availability decides the real order once rows are captured.

## Boundaries

- research/shadow only
- exact identity; no fuzzy matching
- no Official Picks
- APOSTAR disabled
- no production promotion
- no historical Odds API spend

# F1 strict-pregame subset admission V1

Status: **ADMITTED FOR HISTORICAL RESEARCH ONLY**

This audit admits a deliberately small subset from `public.mlb_ml_xyear_features_v1` for new F1 research. It does **not** certify the rows as original as-published sportsbook-time snapshots. The source is a reconstructed historical feature surface, but every admitted row must carry `feature_cutoff_date < game_date`.

## Exact join audit

| Season | F1↔xyear joined | Exact team identity | Strict-prior cutoff | Complete admitted subset |
|---|---:|---:|---:|---:|
| 2025 | 2,428 | 2,428 | 2,428 | 2,133 |
| 2026 | 2,255 | 2,255 | 2,255 | 1,966 |

The 2026 outcome surface ends 2026-09-14; prospective Sep19+ data are not read.

## Admitted inputs

Only ten paired differences are admitted:

1. win percentage
2. run differential per game
3. Pythagorean win percentage
4. offense OPS proxy
5. offense strikeout rate
6. starter L5 RA9
7. starter L5 WHIP
8. bullpen RA9
9. bullpen WHIP
10. rest days

Starter differences are oriented so positive means a home-side advantage (away RA9/WHIP minus home RA9/WHIP). Other pair differences use home minus away.

Excluded: lineup, FULL/current-game fields, historical/closing odds, weather/umpire without a separate certificate, and sparse features.

## Evidence label

`ADMITTED_HISTORICAL_RECONSTRUCTED_STRICT_PRIOR_RESEARCH_ONLY`

This is historical-seen development, not a fresh external holdout and not a claim that every underlying feature was captured live before first pitch. It is sufficient for a leakage-safe reconstructed historical research experiment because the exact game/team join and row cutoff are enforced.

## Boundaries

No provider calls, Odds API credits, database writes, tracker edits, Official Picks, APOSTAR or production changes.

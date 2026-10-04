# MLB Postseason History Materialization V1

Status: **RESEARCH/SHADOW ONLY**

## Problem

Raw Statcast ingestion already contains postseason rows (F Wild Card and D Division Series),
but several downstream history/outcome materializations were still hardcoded to regular season only.

Observed blockers:
- mlb_ml_xyear_refresh_base_v2(date) used game_type='R';
- mlb_statcast_batter_sdt_game_mv used game_type='R';
- Pitcher Win recent-starter/team-history views/functions used game_type='R'.

Consequences:
- Pitcher K/Outs forward rows could freeze in postseason but not settle from xyear pitcher outcomes;
- completed postseason pitcher starts could not enter later strict-prior history;
- singles/doubles/triples outcomes were unavailable from the S/D/T materialized view;
- Pitcher Win postseason history remained incomplete.

## Repair

Model-eligible game types are R/F/D/L/W.

The repair changes only history/outcome materialization eligibility.

It does not change model formulas, thresholds, historical accuracies, candidate selection rules, exact-line contracts, Official Picks, or APOSTAR.

## Strict-prior rule

Completed postseason rows become eligible only as history for a later target date.
Existing runtime rule remains source_game_date < target_game_date.
Same-date history remains forbidden.

## Backfill policy

After merge, only already-completed postseason dates may be re-materialized as postgame history/outcome data.
This is not retro-freezing predictions; it only repairs canonical outcome/history tables.
The forward prediction artifacts remain immutable.

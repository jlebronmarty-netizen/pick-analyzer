# MLB Opening Consensus V2 — Forward Runtime

Status: **RESEARCH-ONLY / SHADOW-ONLY**

This runtime layers V2 on top of V1 forward rows already frozen before first pitch.

It makes **no additional odds-provider calls**.

## Freeze

For each PENDING V1 row before first pitch:
- read the same pregame xyear feature row;
- require actual_winner NULL;
- require feature_cutoff_date < target_date;
- compute the four frozen secondary components;
- missing secondary data fails closed;
- freeze V2 only when secondary score >=2.

Confidence labels:
- 2 = STANDARD
- 3 = STRONG
- 4 = MAX

These labels do not change eligibility.

## Settlement

After scheduled start, the runtime checks MLB Official.
Only FINAL games can settle.

The result is written only to `mlb_ml_opening_consensus_v2_forward_v1`.
No model recomputation occurs at settlement.

## Boundaries

- research only;
- V1 remains the parent market/6-of-6 gate;
- no team-name filter;
- no new odds calls;
- no threshold or vendor changes;
- Official Picks untouched;
- APOSTAR disabled.

The Sep26 CWS vs COL row is the first frozen V2 crossing and has score 3/4 (STRONG).

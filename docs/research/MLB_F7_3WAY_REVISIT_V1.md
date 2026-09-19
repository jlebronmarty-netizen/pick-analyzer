# MLB First 7 Innings 3-Way Moneyline — Second-Pass Revisit V1

Status: `REVISIT_SECOND_PASS_BELOW_75`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Historical target surface

The second pass uses the already-certified F7 score surface with an explicit three-class outcome:

- HOME when home F7 score > away F7 score;
- AWAY when away F7 score > home F7 score;
- DRAW when the F7 score is tied.

2025:

- 2,418 exact Statcast/Retrosheet F7 matches;
- 12 one-run mismatches excluded fail-closed.

2026:

- 2,255 complete Statcast F7 score games through 2026-09-14;
- recent unavailable F7 scores remain excluded fail-closed.

Total source rows: **4,673**.

Class distribution:

- HOME: 2,221;
- AWAY: 1,945;
- DRAW: 507.

Rolling OOF: **4,142** games.

## Architectures tested

This was a materially different second-pass architecture.

Tested:

- CatBoost multiclass HOME/AWAY/DRAW;
- all-class confidence filters;
- side-only confidence filters;
- F7 run-margin regression;
- classifier + run-margin side agreement;
- DRAW-only probability plus near-zero predicted-margin filters;
- original two-sided SP-RA9/win-percentage rule as benchmark.

All folds were chronological and the DRAW outcome was modeled directly. No postgame draw filter was used.

## Gate-selected fallback

Research identifier:

`f7_3way_revisit_side_margin_p055_m150_fallback_v1`

Rule:

- selected outcome is HOME or AWAY;
- multiclass probability for the selected side >= 0.55;
- predicted absolute F7 run margin >= 1.50;
- multiclass side and margin-regression side agree.

Rolling OOF:

- **103 / 178 = 57.87%**;
- coverage: **4.30%**;
- 10 months with selections;
- minimum monthly n: 2;
- worst month: **47.06%**;
- unconditional majority-class baseline: **46.96%**;
- lift: **+10.91 pts**.

It did not meet the 75% target or the 65% worst-month stability floor.

## Highest pooled accuracy candidate

The original first-pass two-sided benchmark produced the highest pooled accuracy among the persisted sample-eligible candidates:

- **96 / 149 = 64.43%**;
- worst month: **41.18%**;
- 10 months;
- lift vs unconditional majority class: **+17.47 pts**.

The pooled accuracy remains below 75% and stability is inadequate.

## Closeout

No HOME/AWAY/DRAW second-pass candidate reached the frozen gate.

State:

`REVISIT_SECOND_PASS_BELOW_75`

- forward eligible: false;
- 2026-09-19 remains quarantined;
- no 2026-09-20+ outcomes were opened;
- do not threshold-rescue using prospective outcomes.

## Boundaries

Official Picks writes: 0.

APOSTAR: disabled.

Production promotion: none.

Historical Odds API credits consumed: 0.

The temporary Supabase research exporter was closed after the bounded run.

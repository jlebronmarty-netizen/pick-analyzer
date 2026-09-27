# MLB Pitcher Outs O13.5 Line Surface V1

Status: **RESEARCH-ONLY / FORWARD VALIDATION REQUIRED**

This experiment extends the frozen Pitcher Outs line-surface to the exact **13.5** line now observed at FanDuel.

## Frozen architecture

Projection:

`0.50 × prior season-to-date outs/start + 0.50 × L5 outs/start`

Minimum prior starts: 5.

Development:
- 2025 only;
- exact line 13.5;
- both directions were tested;
- threshold grid 12.00..20.00 by 0.25;
- source history strictly before target date;
- no same-date doubleheader history.

Gates:
- accuracy >=75%;
- n >=60;
- >=5 months;
- worst month >=65%;
- lift >=5 pp.

Champion policy inherited from the existing line-surface protocol:
maximize selected n among passing candidates.

## Frozen candidate

**OVER 13.5 when projection >=16.00**

2025:
- 1,526/1,802 = **84.68%**
- baseline **79.32%**
- lift **+5.37 pp**
- worst month **81.72%**
- minimum monthly n 72

2026 diagnostic, no retune:
- 1,437/1,690 = **85.03%**
- baseline **76.94%**
- lift **+8.09 pp**
- worst month **80.75%**
- minimum monthly n 75

State:
`CROSS_YEAR_DIAGNOSTIC_STABLE_75_PLUS_FORWARD_VALIDATION_REQUIRED`.

2026 is diagnostic, not pristine external, because Pitcher Outs outcomes were already inspected by prior families.

## FanDuel 2026-09-27

FanDuel had Janson Junk O13.5 at -112.

Frozen projection: **13.371 outs**

Gate: projection >=16.00

Decision: **NO_PLAY**.

The exact FanDuel surface exists, but today's pitcher does not qualify.

## Boundaries

- no threshold retuning;
- no line extrapolation;
- no Official Picks;
- APOSTAR disabled;
- no production promotion;
- no historical Odds API spend.

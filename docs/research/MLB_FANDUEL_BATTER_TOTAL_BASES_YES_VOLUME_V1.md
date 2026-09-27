# MLB FanDuel Batter Total Bases YES Volume V1

Status: **RESEARCH-ONLY / 2025 DEVELOPMENT ONLY**

FanDuel currently exposes Total Bases primarily as YES milestones. Existing strong Total Bases contracts are UNDER-oriented, so this experiment tests a genuinely separate architecture rather than inverting the certified models.

## Frozen protocol

Feature:
`prior PA/game`, computed only from dates strictly before the target date.

Exact lines:
- 1.5 YES
- 2.5 YES
- 3.5 YES
- 4.5 YES

Grid frozen before results:
- prior PA/game >= 3.00..5.00 by 0.05

Gates:
- n >= 60
- accuracy >= 75%
- >=5 months
- worst selected month >=65%
- lift >=5 pp

## Result

No exact YES line produced a passing candidate.

Best observed n>=60 points:
- 1.5 YES: 43.34%, n=2,506, +9.89 pp lift, worst month 41.35%
- 2.5 YES: 30.14%, n=574, +10.62 pp lift, worst month 23.61%
- 3.5 YES: 23.52%, n=574, +9.66 pp lift, worst month 20.83%
- 4.5 YES: 11.15%, n=269, +4.55 pp lift, worst month 0%

Disposition:
`NO_75_PLUS_STABLE_TOTAL_BASES_YES_VOLUME_SIGNAL / NO_RETUNE`.

2026 remains sealed because development failed.

This does not alter:
- certified Total Bases U2.5;
- frozen U1.5 low-volume candidate;
- prior exact-line UNDER closeouts.

No side inversion or threshold rescue is permitted.

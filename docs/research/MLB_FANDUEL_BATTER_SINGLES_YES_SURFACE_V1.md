# MLB FanDuel Batter Singles YES 0.5 Surface V1

Status: **RESEARCH-ONLY / 2025 DEVELOPMENT ONLY**

FanDuel exposes Batter Singles primarily as YES 0.5. The existing certified Singles contract is UNDER 1.5, so this is a separate exact-side experiment.

Frozen before results:
- line: 0.5
- side: YES
- feature: strict-prior singles rate × prior PA/game opportunity
- minimum 10 prior games
- threshold grid 0.10..1.50 by 0.05
- n>=60, accuracy>=75%, >=5 months, worst month>=65%, lift>=5 pp
- same-date history forbidden

Result:
- no threshold passed the signal gate;
- best accuracy among n>=60 was threshold 0.90:
  - n=630
  - accuracy **55.87%**
  - baseline **42.70%**
  - lift **+13.18 pp**
  - worst month **52.86%**

Disposition:
`NO_75_PLUS_STABLE_SINGLES_YES_SIGNAL / NO_RETUNE`.

2026 remains sealed. The certified Singles U1.5 contract remains unchanged.

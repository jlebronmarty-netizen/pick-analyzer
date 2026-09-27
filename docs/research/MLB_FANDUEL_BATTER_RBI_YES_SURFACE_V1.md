# MLB FanDuel Batter RBI YES Surface V1

Status: **RESEARCH-ONLY / 2025 DEVELOPMENT ONLY**

Objective: test the FanDuel-visible Batter RBI milestone YES surfaces without reusing the certified UNDER 0.5 contract.

Exact surfaces:
- Batter RBI 0.5 YES
- Batter RBI 1.5 YES

Projection:
`0.50 * (prior RBI / prior PA * L10 PA/game) + 0.50 * L10 RBI/game`

Eligibility:
- minimum 10 strict-prior games;
- source history must satisfy `source_game_date < target_game_date`;
- same-date history is forbidden, including Game 1 of a doubleheader for Game 2.

Frozen search protocol, declared before results:
- development season: 2025 only;
- threshold grid: 0.00 through 2.00 by 0.05;
- select YES when projection >= threshold;
- n >= 60;
- accuracy >= 75%;
- >= 5 selected months;
- worst month >= 65%;
- lift >= 5 pp over exact-line unconditional baseline.

## Result

**No threshold passes the full signal gate on either exact YES surface.**

Batter RBI 0.5 YES:
- unconditional baseline: 29.45%;
- highest observed accuracy among thresholds with n>=60: 38.20% at threshold 1.05, n=500;
- worst selected month at that point: 33.33%;
- far below the 75% target.

Batter RBI 1.5 YES:
- no threshold passed the frozen gate;
- unconditional baseline: 10.44%.

Disposition:
`NO_75_PLUS_STABLE_RBI_YES_SIGNAL / NO_RETUNE`.

The existing Batter RBI U0.5 <=0.10 contract remains unchanged and separate. FanDuel currently exposing YES without NO/UNDER does not authorize side inversion.

2026 remains unopened for this failed family because no 2025 candidate passed the gate.

Boundaries:
- no side inversion;
- no threshold rescue;
- no 2026 tuning;
- no Official Picks;
- APOSTAR disabled;
- no production promotion;
- no historical Odds API spend.

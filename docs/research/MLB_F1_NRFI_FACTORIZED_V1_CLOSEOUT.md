# F1 NRFI Factorized V1 — Closeout

Status: **RESEARCH ONLY / DEVELOPMENT GATE FAILED / EXTERNAL CLOSED**

Contract: `MLB_F1_NRFI_FACTORIZED_V1/1.0.0`

This frozen architecture was committed before evaluation and used the certified NRFI historical-development source only. It factorizes the two half-inning scoreless probabilities using Beta-smoothed pitcher and offense zero rates in log-odds space, then multiplies the two half probabilities into a game-level NRFI probability.

Frozen settings:
- exact same-season strictly-prior histories;
- score entire calendar date before updating histories;
- Beta(1,1) league prior;
- entity prior strength 20;
- minimum 3 prior starts per pitcher;
- minimum 10 prior games per offense;
- minimum 300 prior league games;
- NRFI if p >= 0.75, YRFI if p <= 0.25;
- no threshold grid or post-result retuning.

Observed historical-development result:
- source rows: **4,683**
- eligible: **3,188**
- excluded insufficient prior history: **1,495**
- selected: **0**
- coverage: **0%**
- accuracy: undefined
- selected months: 0
- state: `DEVELOPMENT_GATE_FAILED_NO_EXTERNAL`

The architecture never crossed the frozen selection confidence. This is a coverage failure, not 0% accuracy. Do not lower the confidence threshold or modify smoothing to rescue it.

External remains closed. The prior fallback result is preserved separately and is not used to rescue this architecture.

Boundaries:
- research-only
- zero provider calls
- zero historical Odds API credits
- Official Picks unchanged
- APOSTAR disabled
- no production promotion
- tracker unchanged

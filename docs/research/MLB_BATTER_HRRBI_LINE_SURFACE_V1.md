# MLB Batter HRRBI Line Surface V1

Status: **RESEARCH ONLY / EXTERNAL GATE CLOSED**

Contract: `MLB_BATTER_HRRBI_LINE_SURFACE_V1/1.0.0`

## Exact replay recovery

The exact 2025 Retrosheet archive was recovered and verified before any line-surface search:

- archive SHA-256: `3d1e0e81d5913a635ae7a80366b811b777b832b488274124b4e38e04dd892753`
- regular-season games: **2,430**
- regular batting rows: **71,550**
- eligible player-game rows after the minimum-history gate: **58,410**

The unique lineage that reproduces both frozen controls and every frozen monthly count is:

- sequential strictly prior player games within 2025;
- minimum 10 prior games;
- Retrosheet exact `b_pa`;
- recent window = 10;
- component = `0.50*(prior_event_per_PA*L10_PA_per_game)+0.50*L10_event_per_game`;
- HRRBI = projected hits + projected runs + projected RBI.

Parity controls:

- RBI U0.5 <=0.10: **2053/2402 = 85.47%**
- HRRBI U2.5 <=0.70: **2278/2582 = 88.23%**

Both reproduce exactly, including month-by-month counts.

## Frozen development search

The threshold grid was fixed at **0.00 to 5.00 by 0.05** before evaluating HRRBI 0.5/1.5.

Development gates:

- accuracy >=75%
- n >=60
- >=5 selected months
- worst selected month >=65%
- lift >=5 pp over the exact-line unconditional baseline
- Wilson lower bound reported
- choose maximum n among passing thresholds

### UNDER 0.5

Frozen candidate:

`batter_hrrbi_under_0p5_proj_0p05_v1`

Rule:

`HRRBI projection <= 0.05`

2025 development:

- n = **118**
- wins = **117**
- accuracy = **99.15%**
- exact-line baseline = **52.17%**
- lift = **+46.98 pp**
- selected months = **5**
- worst month = **96.00%**
- Wilson lower = **95.36%**

State:

`DEVELOPMENT_GATE_PASS_EXTERNAL_GATE_CLOSED`

### OVER 0.5

No threshold passed all development gates.

State:

`NO_75_PLUS_STABLE_SIGNAL_CANDIDATE`

### UNDER 1.5

Frozen candidate:

`batter_hrrbi_under_1p5_proj_0p90_v1`

Rule:

`HRRBI projection <= 0.90`

2025 development:

- n = **4,795**
- wins = **3,607**
- accuracy = **75.22%**
- exact-line baseline = **68.11%**
- lift = **+7.12 pp**
- selected months = **6**
- worst month = **71.77%**
- Wilson lower = **73.98%**

State:

`DEVELOPMENT_GATE_PASS_EXTERNAL_GATE_CLOSED`

### OVER 1.5

No threshold passed all development gates.

State:

`NO_75_PLUS_STABLE_SIGNAL_CANDIDATE`

## Current exact-line relevance

The persisted 2026-09-22 board already showed:

- HRRBI 0.5 at BetMGM, Bovada, DraftKings and William Hill/Caesars key `williamhill_us`;
- HRRBI 1.5 at BetMGM, Bovada, DraftKings, Fanatics and William Hill/Caesars.

No provider call was made for this research.

## Gate

**Do not open 2026 yet.**

Both UNDER candidates passed the 2025 development gate and their thresholds are now frozen. The next step requires an explicitly authorized validation/forward gate.

Prior 2026 HRRBI-family outcomes have already been seen for the existing U2.5 candidate family, so any later 2026 evaluation must be labeled according to the actual evidence status and must not be described as pristine external unless justified.

No threshold rescue or retuning is authorized after any 2026 read.

## Boundaries

- research-only
- Official Picks unchanged
- APOSTAR disabled
- no production promotion
- zero historical Odds API credits
- no sportsbook/provider calls
- tracker unchanged

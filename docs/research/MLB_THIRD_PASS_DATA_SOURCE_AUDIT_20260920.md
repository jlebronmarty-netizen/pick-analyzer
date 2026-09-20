# MLB third-pass architecture + data-source audit — 2026-09-20

State: `RESEARCH_ONLY_NO_PROMOTION`

## Safety boundaries

- Official Picks creation unchanged.
- APOSTAR remains disabled.
- No production model promotion.
- No historical Odds API credits consumed.
- No 2026-09-20+ outcomes opened for the below failed-market architecture probes.
- No fuzzy player identity.

## Third-pass architecture probes

These probes are materially different from the already-closed first/second-pass CatBoost/composite candidates.

### F1 NRFI/YRFI — independent half-inning scoring architecture

Architecture:
- estimate away top-1 scoring probability from away offense prior scoring rate + home starter first-inning allowance history;
- estimate home bottom-1 scoring probability from home offense prior scoring rate + away starter first-inning allowance history;
- combine into NRFI probability as `(1-p_away_score)*(1-p_home_score)`;
- fixed offense/starter blend grid 25/50/75%;
- fixed confidence thresholds 0.60 through 0.80;
- all histories strictly prior to target game;
- development surface ends 2026-09-14.

Best n>=50:
- NRFI, offense weight 0.25, threshold 0.75: 34/52 = **65.38%**.
- temporal stability failed: worst month 0.00%, min selected month n=1.

Closeout: `THIRD_PASS_BELOW_75_NO_FREEZE`.

### F1 Moneyline — directional half-scoring separation

Architecture:
- reuse the independently estimated top/bottom first-inning scoring probabilities;
- select HOME/AWAY only when scoring-probability separation, high-side floor and low-side ceiling all agree;
- fixed small gate grid.

Best n>=30:
- 21/37 = **56.76%**.
- worst month 0.00%.

Closeout: `THIRD_PASS_BELOW_75_NO_FREEZE`.

### Game Totals — transparent extreme-environment agreement

Architecture:
- use real stored close total;
- require simultaneous agreement from:
  - home/road offense scoring environment,
  - average starter RA9,
  - average bullpen RA9;
- fixed small UNDER/OVER threshold grid;
- no ML model / no CatBoost.

Best n>=20:
- OVER extreme: 12/21 = **57.14%**, worst month 30.00%.
- UNDER best: 44/81 = **54.32%**, worst month 0.00%.

Closeout: `THIRD_PASS_BELOW_75_NO_FREEZE`.

### F5 Moneyline — selective team-strength + starter + offense agreement

Architecture:
- side must agree across:
  - prior win-percentage advantage,
  - starter RA9 advantage,
  - offense OPS-proxy advantage;
- fixed predeclared gates only.

Results:
- base gate win>=0.10, starter RA9 edge>=1.00, OPS edge>=0.04:
  - 172/297 = **57.91%**.
- strict gate 0.15 / 1.50 / 0.06:
  - 73/133 = **54.89%**.
- stricter gate 0.15 / 2.00 / 0.08:
  - 47/82 = **57.32%**.
- temporal stability failed.

Closeout: `THIRD_PASS_BELOW_75_NO_FREEZE`.

Do not continue threshold hunting on these same architectures.

## Data-source recovery audit

### Retrosheet — free

Official 2025 CSV archive:
- source: `https://www.retrosheet.org/downloads/2025/2025csvs.zip`
- archive SHA-256: `3d1e0e81d5913a635ae7a80366b811b777b832b488274124b4e38e04dd892753`
- regular-season games: 2,430.

Recovered exact player-game labels:
- Runs,
- RBI,
- Stolen Bases,
- Pitcher Strikeouts,
- Pitcher Outs.

This unblocked the 2025 development labels for Runs/RBI/HRRBI/SB and independently supports pitcher outcomes.

### SportsDataIO

Official documentation says MLB Game Lines include full-game and partial-game markets such as 1st-5th, with opening/closing and line movement.

Observed project evidence:
- `GameOddsByDate` succeeded with HTTP 200 on 2026-08-11.
- project persisted current operating-day moneyline / total / run_line snapshots.
- current normalized SportsDataIO snapshot markets do **not** include F1/F3/F5/F7 period markets or team totals.
- a verification request to `/api/mlb/odds/json/GamesByDate/2026-SEP-16` returned HTTP **401**.
- therefore current authorization/credential access must be repaired/verified before using SportsDataIO for additional line recovery.
- SportsDataIO Historical Betting Archive is a separate historical-access surface; access is account-dependent and should not be assumed.

### BALLDONTLIE

Current MLB documentation:
- betting odds available starting in 2026;
- opening odds endpoint exists;
- complete current market catalogs are available for DraftKings/FanDuel;
- historical opening player props require GOAT;
- live player props are not stored historically outside the opening-props endpoint.

Potential use:
- 2026 opening/market recovery where exact market structure exists;
- independent price/line cross-check;
- not a substitute for 2025 period-line history unless documented coverage proves it.

### The Odds API

Current documentation confirms:
- current MLB moneyline/spread/total;
- innings markets including first five;
- historical featured markets from mid-2020;
- historical calls consume provider credits under the existing project budget model.

Policy:
- do not spend historical credits until SportsDataIO/BALLDONTLIE/free-source coverage is exhausted and exact required market keys are confirmed.

## Current priority order

1. Repair/verify SportsDataIO authorization and inspect BettingMarket/period access without exposing secrets.
2. Probe BALLDONTLIE 2026 opening/market coverage if an authorized key is available.
3. Use recovered Retrosheet labels to expand outcome research (already active).
4. Preserve F1 NRFI/F1 ML/F5 ML/Game Totals third-pass failures and stop tuning these architectures.
5. Reserve The Odds API historical credits for exact line gaps that cannot be filled elsewhere.

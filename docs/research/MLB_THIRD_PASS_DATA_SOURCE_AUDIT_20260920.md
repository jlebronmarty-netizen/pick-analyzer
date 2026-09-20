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

### SportsDataIO — legacy stored data only, NOT an active subscription

User-confirmed active subscriptions do **not** include SportsDataIO.

Project history still contains legacy/quarantined SportsDataIO rows and old runtime compatibility code. Those rows may be used only as already-stored historical evidence when their lineage is independently valid. They must **not** be treated as an available provider, current entitlement, fallback subscription, or future acquisition source.

The current odds-authority code still contains legacy SportsDataIO stage/rollback concepts. Do not change product authority automatically from this research branch; a production authority change requires an explicit gate. Until then, any path that requires new SportsDataIO calls must fail closed.

### BALLDONTLIE GOAT — active subscription / first acquisition priority

User-confirmed active subscription: **GOAT**.

Current MLB documentation confirms:
- historical opening betting odds are available through `/mlb/v1/odds/opening`, with coverage limited to the most recently completed season and ongoing season where available;
- opening player props are available through `/mlb/v1/odds/player_props/opening` and require GOAT;
- complete current market catalogs are available for DraftKings and FanDuel through `/mlb/v1/odds/markets`;
- current player props support FanDuel, DraftKings, Caesars, BetMGM, BetRivers and Fanatics;
- live/current player props are not a complete historical archive, so opening-props is the historical source of record for 2026 prop research.

Priority use:
1. recover 2026 opening player-prop lines/prices for certified prop models;
2. inspect current complete market catalogs for exact supported period/team-total market structures;
3. use opening game odds for 2026 full-game line cross-checks;
4. do not assume 2025 coverage because MLB opening-odds historical coverage is limited to recent/ongoing seasons.

BALLDONTLIE is the preferred 2026 acquisition source before spending The Odds API historical credits.

### The Odds API

Current documentation confirms:
- current MLB moneyline/spread/total;
- innings markets including first five;
- historical featured markets from mid-2020;
- historical calls consume provider credits under the existing project budget model.

Policy:
- do not spend historical credits until SportsDataIO/BALLDONTLIE/free-source coverage is exhausted and exact required market keys are confirmed.

## Current priority order

1. Integrate/probe **BALLDONTLIE GOAT** research-only for 2026 opening odds, opening player props and complete current market catalogs; no secret exposure.
2. Reuse the existing **The Odds API** integration for exact market discovery and only spend historical credits after BALLDONTLIE/free coverage is exhausted.
3. Use recovered Retrosheet/MLB free labels to expand outcome research.
4. Preserve F1 NRFI/F1 ML/F5 ML/Game Totals third-pass failures and stop tuning those same architectures.
5. Treat SportsDataIO only as legacy stored evidence; make **zero new SportsDataIO calls**.
6. Separately audit the legacy odds-authority config because its default still references SportsDataIO; do not change production authority without an explicit gate.


## Additional line-free third-pass probes

### F1 3-Way DRAW — low-scoring probability transfer

Reused the independently estimated top/bottom first-inning scoring probabilities, but targeted DRAW rather than NRFI.

Best n>=50:
- offense weight 0.25;
- low-scoring / NRFI-like threshold 0.75;
- **35/52 = 67.31%**;
- worst month **0.00%**;
- min selected month n=1.

Closeout: `THIRD_PASS_BELOW_75_NO_FREEZE`.

### F3 Moneyline — period-run expectation architecture

Materially different from the previous classifier/regression revisit.

Features:
- strictly prior F3 team scoring and F3 runs allowed;
- season-to-date + L10 period scoring;
- opposing starter RA9;
- fixed weight grid;
- fixed predicted-margin thresholds.

Best n>=50:
- team weight 0.50;
- starter weight 0.30;
- predicted F3 margin >=0.75;
- **103/162 = 63.58%**;
- worst month **41.67%**.

Closeout: `THIRD_PASS_BELOW_75_NO_FREEZE`.

### F7 Moneyline — period-run + starter + bullpen architecture

Features:
- strictly prior F7 scoring/allowance;
- L10 F7 team context;
- opposing starter RA9;
- opposing bullpen RA9;
- fixed transparent weight grid;
- fixed margin thresholds.

Best n>=50:
- weights 0.45 team / 0.25 opponent allowance / 0.20 starter / 0.10 bullpen;
- predicted margin >=1.50;
- **42/58 = 72.41%**;
- worst month **0.00%**;
- min selected month n=1.

Closeout: `THIRD_PASS_BELOW_75_NO_FREEZE`.

These additional probes do not justify a fourth threshold pass. New work requires materially new information or exact historical market points.

## BALLDONTLIE GOAT credential placement audit

Canonical environment variable from the existing NBA/NFL BALLDONTLIE integration:

`BALLDONTLIE_API_KEY`

Verified existing scripts already use this exact variable.

Temporary MLB GOAT probes were built read-only and preview-only, but:
- GitHub Actions reported the BALLDONTLIE probe credential step as absent/skipped;
- no BALLDONTLIE provider call was made from the probe;
- Vercel Deployment Protection prevented external execution of the preview route;
- available Vercel tools do not expose environment-variable names/values.

Therefore current state is:

`BALLDONTLIE_GOAT_ACCESS_CONFIRMED_BY_USER_KEY_PLACEMENT_NOT_VERIFIED_IN_RUNTIME`

No GOAT line/prop backfill is claimed until the key is available to the execution environment. Do not expose or print the key.

# MLB Main 3 Markets — New Formula Audit V1

Status: **RESEARCH-ONLY / SHADOW-ONLY**

Markets:
1. Moneyline
2. Standard Run Line
3. Full Game Total

## Moneyline

The current forward tracker has 4 frozen picks, with 3 already settled:
- 0 wins
- 3 losses
- 1 pending
- 0.00% on settled picks
- 3.03% coverage

A new bounded architecture was tested using only clean 2025 pregame fundamentals.

Signals:
- season win percentage
- run differential per game
- Pythagorean win percentage
- L5 win percentage
- starter RA9 advantage
- bullpen RA9 advantage

Only three predeclared strength profiles and vote thresholds 4/6, 5/6 and 6/6 were evaluated.

Best pooled row:
- strong profile C
- all 6 signals required
- 31/39 = 79.49%
- FAIL: n<60 and worst month 33.33%

Best configuration with n>=60:
- profile B
- all 6 signals
- 51/69 = 73.91%
- worst month 44.44%
- FAIL

No new 75% stable Moneyline formula was found.

A genuinely different market-residual architecture cannot be cleanly backtested in 2025 because the xyear Moneyline surface has zero historical no-vig open/close probability rows.

## Standard Run Line

2025 canonical standard market:
- DOG +1.5
- FAVORITE -1.5
- 2,430 games

A new FAVORITE -1.5 domination architecture oriented Team Strength, Recent Form, Offense, Starter and Bullpen toward the favorite.

Bounded search:
- component cut: 0.0 / 0.5 / 1.0
- agreement: 3/5 / 4/5 / 5/5

No candidate passed.

Best configuration with meaningful n:
- cut 1.0
- >=3/5 signals
- 56/103 = 54.37%
- worst month 28.57%

Therefore FAVORITE -1.5 is closed for this architecture.

The only current 75%+ Run Line research path remains DOG +1.5 V2:
- core: 53/70 = 75.71%
- transfer: 62/79 = 78.48%
- broad union: 110/143 = 76.92%

These use 2025 plus already-opened 2026 as development evidence, so they require untouched prospective certification.

The separate HOME +1.5 alternate candidate:
- 2025: 92/107 = 85.98%
- 2026 seen development: 49/62 = 79.03%
- Sep19-Sep25 prospective freezes: 0 selected games

Its threshold remains frozen; it must not be lowered to manufacture forward volume.

## Full Game Totals

The project already contains an unusually deep Totals search:
- transparent predicates
- ridge
- separate home/away run models
- binned boosts
- tree models
- Extra Trees
- handedness
- pitch-type matchups
- PVP
- CatBoost
- Poisson side models
- close-margin regression
- cross-year V37

No deployable PREGAME family has reached the 75% stability target.

Latest V37:
- 2025 rolling OOF: 55.32%
- 2026 external selected: 46.13%

A final transparent architecture was tested:

`predicted_total = 0.5*(home SP RA9 + home bullpen RA9) + 0.5*(away SP RA9 + away bullpen RA9)`

Compared against the exact 2025 closing total.

Results:
- edge >=1.5 runs: 195/403 = 48.39%
- edge >=2.0: 95/210 = 45.24%
- edge >=2.5: 57/126 = 45.24%

FAIL.

## Conclusion

We have **not** reached an absolute research limit. We have reached the limit of the **current information families** for these three markets.

Current order of opportunity:

1. **Run Line DOG +1.5 V2** — only main-market path currently above 75% in development; accumulate untouched forward evidence.
2. **Moneyline** — requires genuinely new information, especially timestamped lineup and/or prospective market-probability residuals. Do not retune the current 0-3 forward model.
3. **Totals** — current V1-V37 feature families are exhausted. Further threshold search is not justified. A future attempt requires new information such as exact lineup, umpire/weather, bullpen availability, or market movement.

No Official Picks changes, APOSTAR activation, historical Odds API spend, or threshold rescue occurred.

## New-information follow-up — strict-prior bullpen workload

The original persisted bullpen workload fields were audited before use:

- 3,806 rows from May-Sep 2025;
- 0 nonzero rows for persisted 24h pitches;
- 0 nonzero rows for persisted 72h pitches;
- 0 nonzero high-workload-reliever counts.

Therefore those persisted aggregate fields were rejected as placeholders.

A valid workload family was reconstructed instead from `mlb_ml_xyear_pitcher_game_v1`, which contains team, date, `starter` boolean and pitch count. Bullpen = rows with `starter=false`; only dates strictly before the target date are used.

Observed 2025 team-day bullpen pitch distribution:
- median 58;
- P75 77.25;
- P90 100;
- max 216.

### Moneyline

Bounded freshness rules used fixed 1-day / 3-day differences and same-direction combinations.

Best:
- D1 difference >=45 pitches;
- 227/414 = **54.83%**;
- worst month 48.68%.

FAIL.

### Totals

The workload cutoffs were frozen from the feature distribution before outcome scoring:
- 1-day P20/P80 = 68 / 148;
- 1-day P10/P90 = 0 / 174.4;
- 3-day P20/P80 = 248 / 392;
- 3-day P10/P90 = 211 / 430.

Best directional rule:
- D1 P20/P80;
- 360/773 = **46.57%**;
- worst month 41.18%.

FAIL.

No sign reversal was attempted after seeing outcomes.

### Run Line DOG +1.5

The DOG was selected only when its bullpen was materially fresher than the favorite.

Best with n>=60:
- D1 difference >=45;
- 116/179 = **64.80%**;
- worst month 48.00%.

Highest pooled accuracy:
- BOTH 60/120;
- 17/23 = 73.91%;
- n<60 and worst month 50.00%.

FAIL.

Final state:

`BULLPEN_WORKLOAD_CLOSED_FOR_MAIN_3_MARKETS_NO_SIGN_OR_THRESHOLD_REVERSAL`

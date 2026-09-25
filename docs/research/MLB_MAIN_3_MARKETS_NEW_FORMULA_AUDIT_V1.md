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

# Feature Priority Matrix

Date: 2026-07-29

Status: FUTURE MODEL INPUT PRIORITY

No model training. No production mutation.

| Category | Priority | Reason |
| --- | --- | --- |
| Historical performance | Recommended | 20 observed feature keys, 19.07% average coverage, 1 high/critical leakage-governance flags. |
| Home/Away | Recommended | 145 observed feature keys, 2.51% average coverage, 4 high/critical leakage-governance flags. |
| Unknown | Experimental | 27 observed feature keys, 12.81% average coverage, 0 high/critical leakage-governance flags. |
| Schedule | Recommended | 17 observed feature keys, 14.77% average coverage, 2 high/critical leakage-governance flags. |
| Pitching | Must use | 86 observed feature keys, 2.57% average coverage, 6 high/critical leakage-governance flags. |
| Batting | Recommended | 6 observed feature keys, 20.39% average coverage, 0 high/critical leakage-governance flags. |
| Team strength | Must use | 73 observed feature keys, 1.55% average coverage, 6 high/critical leakage-governance flags. |
| Roster | Optional | 4 observed feature keys, 16.51% average coverage, 0 high/critical leakage-governance flags. |
| Weather | Recommended | 12 observed feature keys, 5.05% average coverage, 0 high/critical leakage-governance flags. |
| Odds | Must use | 28 observed feature keys, 1.51% average coverage, 4 high/critical leakage-governance flags. |
| Market | Must use | 11 observed feature keys, 3.37% average coverage, 0 high/critical leakage-governance flags. |
| Rest | Recommended | 3 observed feature keys, 5.35% average coverage, 0 high/critical leakage-governance flags. |
| System | Training exclude | 11 observed feature keys, 1.07% average coverage, 11 high/critical leakage-governance flags. |
| Opponent quality | Optional | 2 observed feature keys, 4.95% average coverage, 0 high/critical leakage-governance flags. |
| Meta | Training exclude | 3 observed feature keys, 1.51% average coverage, 2 high/critical leakage-governance flags. |
| Streaks | Optional | 1 observed feature keys, 2.87% average coverage, 0 high/critical leakage-governance flags. |

## First Logistic Regression

- Use: Odds, Market, Pitching, Team strength, Batting, Schedule, Home/Away, Rest, Weather
- Exclude: System, Meta, Closing line
- Constraints: Use only pre-cutoff frozen fields. One canonical representation per odds/line field. Regularize correlated rolling form windows. Train only after approved sample threshold is reached.

## Second Gradient Boosting Model

- Use: Odds, Market, Pitching, Team strength, Batting, Schedule, Home/Away, Rest, Weather, Roster, Opponent quality, Streaks, Standings
- Exclude: System, Meta, Closing line
- Constraints: Use after larger walk-forward sample exists. Audit monotonicity and leakage before challenger review. Keep champion/challenger separation; no automatic promotion.

## Future Ensemble

- Use: Odds, Market, Pitching, Team strength, Batting, Schedule, Home/Away, Rest, Weather, Roster, Opponent quality, Streaks, Standings, Line movement, Historical performance
- Exclude: System, Meta, Closing line
- Constraints: Line movement requires genuine opening and pre-cutoff snapshot history. Closing-line fields remain evaluation-only, not pregame predictors. Ensemble requires multi-season, multi-market validation.

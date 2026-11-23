# MLB Batter HRRBI U1.5 Forward Shadow V1

Status: **RESEARCH-ONLY / FORWARD-ONLY**

The 2025 development rule is frozen:
- market: Batter Hits + Runs + RBIs
- exact line: 1.5
- side: UNDER
- projection <= 0.90
- 2025 development: 3,607/4,795 = 75.22%, +7.12 pp lift
- worst development month: 71.77%

The prior 2026 historical external gate remains blocked by MLB Official historical snapshot drift. This forward track does not relabel revised history as the frozen external test.

For 2026-09-25:
- only persisted strict-pregame U1.5 UNDER quotes with exact MLBAM identity are included;
- 119 player-game targets were frozen before results;
- MLB Official gameLog hitting is read with date < 2026-09-25;
- Game 1 of a doubleheader cannot enter Game 2 because same-date history is excluded;
- no fuzzy identity;
- no Odds API calls;
- prices are recorded, but no EV is calculated.

The workflow emits the candidate set to a retained GitHub artifact. It does not write Official Picks or activate APOSTAR.

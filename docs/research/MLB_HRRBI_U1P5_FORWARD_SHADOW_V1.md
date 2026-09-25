# MLB Batter HRRBI U1.5 Forward Shadow V1

Status: **RESEARCH-ONLY / FORWARD-ONLY**

This track operationalizes the already-frozen 2025 candidate:

- exact market: Batter Hits + Runs + RBIs
- exact line: 1.5
- side: UNDER
- projection threshold: <= 0.90
- minimum prior games: 10

Development evidence:
- 3,607 / 4,795 = 75.22%
- lift +7.12 pp
- worst month 71.77%

The retrospective 2026 external gate remains blocked because the original MLB Official snapshot drifted and was not persisted row-by-row. This forward track does **not** repair or reinterpret that retrospective evidence.

For 2026-09-25, 119 exact MLBAM targets with strict-pregame U1.5 UNDER quotes are frozen from the approved sportsbook capture. The evaluator fetches MLB Official gameLog and uses only rows with `game_date < 2026-09-25`.

Projection is the frozen component formula:

`0.50*(prior_event_per_PA*L10_PA_per_game) + 0.50*L10_event_per_game`

summed across hits, runs and RBI.

No threshold retuning, fuzzy matching, EV substitution, Official Picks, APOSTAR, production promotion, or Odds API historical spend.

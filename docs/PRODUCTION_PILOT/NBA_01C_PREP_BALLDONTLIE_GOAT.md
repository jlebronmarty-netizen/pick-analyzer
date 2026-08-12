# NBA-01C-PREP BallDontLie GOAT 48h Extraction Readiness

Status: `BALLDONTLIE_GOAT_TRIAL_EXTRACTION_READY`

This phase prepares the BallDontLie NBA GOAT trial extraction without starting the trial, requiring an API key, calling BallDontLie, calling The Odds API, expanding SportsDataIO, activating NBA production or running replay.

## Provider Plan

| Role | Decision |
| --- | --- |
| The Odds API | NBA odds and historical price authority |
| BallDontLie ALL-STAR | Candidate long-term NBA non-odds source for games, players, player stats, active players and injuries |
| BallDontLie GOAT | 48-hour historical bootstrap for high-value stat endpoints only |
| SportsDataIO | Legacy/trial only; no expansion |

## Trial Profile

| Metric | Value |
| --- | ---: |
| Hard trial limit | 5 requests/minute |
| Configured safe rate | 4 requests/minute |
| Trial duration | 48 hours |
| Reserve duration | 4 hours |
| Safe planned requests | 2477 |
| Estimated queue hours | 10.32 |
| Capacity | FITS_COMFORTABLY_IN_48H |

## P0 Endpoints

| Endpoint | Why | Seasons | Requests | Time |
| --- | --- | --- | ---: | ---: |
| Teams | Identity dimension required before games, stats and event crosswalks. | 2024, 2023, 2022 | 3 | 1 minutes |
| Players | Canonical player identity and stat ownership; obtainable after downgrade but needed early for mappings. | 2024, 2023, 2022 | 150 | 38 minutes |
| Games | Canonical schedule, final score and quarter-score carrier when available. | 2024, 2023, 2022 | 39 | 10 minutes |
| Game Player Stats | Core player-game box stat foundation; period filter supports future quarter-safe research after certification. | 2024, 2023, 2022 | 900 | 225 minutes |
| Box Scores | P0 GOAT endpoint because it can combine game, team and player boxscore context efficiently if schema matches docs. | 2024, 2023, 2022 | 150 | 38 minutes |
| Game Advanced Stats V2 | Advanced stat research store only until NBA model feature promotion is separately certified. | 2024, 2023, 2022 | 900 | 225 minutes |

## Future START

Do not start the trial during PREP. When authorized:

1. Activate the BallDontLie NBA GOAT 48-hour trial.
2. Obtain the API key.
3. Store it locally as `BALLDONTLIE_API_KEY` in `.env.local`.
4. Run `npm exec -- node --loader ./scripts/local-ts-loader.mjs scripts/nba-01c-balldontlie-goat-prep.mjs --phase0`.
5. If Phase 0 is GO, run the future START command documented in certification.

## Safety

Provider calls during PREP: 0. Database mutations during PREP: 0. NBA production activation: no. MLB architecture changes: none.

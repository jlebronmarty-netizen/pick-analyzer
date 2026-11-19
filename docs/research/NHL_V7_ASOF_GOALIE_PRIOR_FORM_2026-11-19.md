# NHL goalie prior-form research V7 — as-of only (Nov 19, 2026)

The independent late NHL V6 capture can already freeze free ESPN probable-goalie names. This V7 enrichment matches those probable identities to **historical official NHL postgame boxscore rows that were captured BEFORE the late decision**. It does not confirm the coming game's starter or change Poisson probabilities.

## Data audit before implementing
- Read-only Supabase audit over 3 real ESPN V5 goalie captures (Nov 16–18) found 16 matchups, **32 probable goalie sides**.
- In the existing `nhl_game_context_v2` boxscore archive, same-team + exact first initial + surname matching to previous games yields **31/32 names with a unique candidate NHL goalie ID**; **0 ambiguous multiple-ID matches**.
- **27 of those 32 sides** had at least **50 prior shots faced** recorded, **12 had at least 100**. The single unmatched name was **Nikita Tolopilo** in an away-side Vancouver probable; do not infer his NHL ID from postgame data or other team's boxscore.
- The current archive contains 111 NHL game boxscores with official final states OFF/FINAL. It is not a confirmed-starter source.

## What is captured
- Pure library `src/lib/nhl-goalie-prior-form-asof-v7.mjs` takes an original ESPN probable, exact team ID and archived official previous game boxscores with `boxscore_captured_at <= frozen_at`, actual prior start before source observation, and final game state.
- Uses unique exact NHL goalie player ID candidate from same team + full first initial + surname; never treats ESPN athlete ID as NHL player ID.
- Computes recent five *played* games' total shots against, goals against, shot-weighted prior save percentage; requires >=50 shots for a usable research attribute. Duplicated prior NHL event IDs and uncertain abbreviated-name collisions fail closed.
- Attaches `goalie_evidence.historicalFormV7` as frozen metadata to prospective **new V6** rows, separately for home and away. Explicit flags retain `isConfirmedStarter:false`, `goalieNhlIdentityCrosswalkVerified:false`, `goalieAdjustmentApplied:false` and `official_pick:false`. Source digest includes this historical feature for provenance.
- The V6 writer reads the already archived `nhl_game_context_v2` table. **Zero new provider calls** or paid credits; missing boxscores degrade only optional research feature and never block base V6 source capture.
- The read-only V6 readiness report now counts matched historical goalie forms by both teams and >=50-shot threshold; no formula or market contract changes.

## How to test accuracy responsibly
1. Freeze V6 probabilistic decisions regardless of goalie form status. No retrofitting game results or prior boxscores captured later.
2. After enough independent future matchups settle, compare identical-game subsets by goalie historical form coverage (`both usable`, `partial`, `missing`) and actual outcome. This is *stratification*, not proof that the goalie statistics caused better performance.
3. Develop a separate goalie-aware V7 model challenger with a predeclared coefficient based on prior save% and recent opponent shot rates; freeze it separately and compare paired Brier, Log Loss, goal-total MAE and Puck Line against unadjusted Poisson V6. Do not tune coefficients over multiple overlapping tests or auto-promote.
4. Obtain documented truly confirmed pregame starters from a separately timestamped source before using a `confirmed` label or treating a projected goalie as guaranteed starter. Published status and rights must be verified before any automated scraper/API polling.

## Deployment boundaries
- Only V6 research code / source-readiness is extended; early V1 and original DRatings predictions are immutable.
- No database migration: V6 existing `goalie_evidence` JSONB carries additive `historicalFormV7` metadata.
- Existing 22:07 UTC free ESPN goalie capture and NHL cron schedule are unchanged.
- Tests reject future-game boxscore leakage, duplicate archived games, multiple goalie IDs for same abbreviated name, wrong team, missing shots, and any official-pick label.
- A passing CI/preview build is not prospective model validation; collect real new V6 and outcome rows before claiming an accuracy improvement.

# Retrosheet Historical Coverage Intelligence Phase 1.5

Status: READ-ONLY AUDIT COMPLETE  
Date: 2026-07-22  
Starting commit: `a2c0e3ff079abed176dd9dccef5e3c313fdebf4f`  
Certification basis: `RETROSHEET_DATABASE_FOUNDATION_PASS`  
Scope: 2025 MLB Retrosheet historical tables only

This audit catalogs analytical features that can be derived from the persisted Retrosheet historical database. It does not create prediction features, model inputs, training datasets, Learning Brain inputs, replay outputs, player-prop outputs or production behavior changes.

## Executive Summary

The current database is strong for postgame-derived baseball intelligence: game outcomes, teams, venue, weather fields, umpire fields, lineups, substitutions, play sequence, base/out state, pitcher appearances and batter plate appearances are all available for the imported 2025 season. The strongest immediate capabilities are pitcher workload/form, batter production, bullpen usage, lineup continuity, team run environment, park context, umpire context and game-state/situational aggregates.

The primary limitations are:

- Only one season is imported, so long-horizon park factors, multi-year player aging, prior-season priors and robust historical matchup samples remain partial.
- Player identities are source-stable but not trusted canonical MLB identities yet: 1,470 player identity rows remain unresolved by design.
- Handedness, defensive outcomes by fielder, pitch type, pitch velocity, Statcast quality of contact, travel miles, betting lines and pregame injury/lineup availability are not present.
- Historical rows remain `historical_only=true`, `postgame_known=true`, `training_eligible=false`, `pregame_eligible=false`; they are audit-ready but not prediction-engine-ready.

## Measured Coverage

Read-only production aggregate checks returned:

| Area | Count | Coverage |
|---|---:|---:|
| Source files | 61 | 100.00% |
| Event files/checkpoints | 30 | 100.00% |
| Raw records | 399,497 | 100.00% |
| Raw play records | 216,845 | 100.00% |
| Games | 2,430 | 100.00% |
| Valid games | 2,332 | 95.97% |
| Valid with warnings | 98 | 4.03% |
| Quarantined games | 0 | 0.00% |
| Games with date, venue, start time, day/night, DH, attendance, duration and innings | 2,430 | 100.00% |
| Games with canonical home and away teams | 2,430 | 100.00% |
| Games with winning and losing pitcher | 2,430 | 100.00% |
| Games with save pitcher | 1,201 | 49.42% |
| Games with weather object | 2,430 | 100.00% |
| Games with umpire object | 2,430 | 100.00% |
| Lineup entries | 76,135 | 100.00% |
| Starting lineup entries | 48,600 | 20 per game |
| Substitution lineup entries | 27,535 | 100.00% |
| Lineup entries with player names | 76,135 | 100.00% |
| Pitcher lineup entries | 20,887 | 100.00% |
| Substitution records | 27,535 | 100.00% |
| Plays | 216,845 | 100.00% |
| Plays with pitcher, count and pitch sequence | 216,845 | 100.00% |
| Run-scoring plays | 16,652 | 7.68% of plays |
| Out-recording plays | 123,665 | 57.03% of plays |
| Pitcher appearances | 20,870 | 100.00% |
| Starting pitcher appearances | 4,860 | 2 per game |
| Reliever appearances | 16,010 | 100.00% |
| Pitcher appearances with pitch count | 20,864 | 99.97% |
| Pitcher appearances with decision | 6,061 | 29.04% |
| Batter appearances | 189,311 | 100.00% |
| Batter appearances with pitcher | 189,311 | 100.00% |
| At-bats | 172,004 | 90.86% of PA rows |
| Hits | 40,427 | 21.36% of PA rows |
| Walks | 17,307 | 9.14% of PA rows |
| Strikeouts | 40,645 | 21.47% of PA rows |
| Home runs | 5,650 | 2.98% of PA rows |
| Stolen bases | 3,297 | 1.74% of PA rows |
| Caught stealing | 989 | 0.52% of PA rows |
| Grounded into double play | 3,122 | 1.65% of PA rows |
| Identity rows | 3,930 | 100.00% |
| Resolved identities | 2,460 | 62.60% |
| Unresolved player identities | 1,470 | 37.40% |
| Historical games marked pregame eligible | 0 | 0.00% |
| Historical games marked training eligible | 0 | 0.00% |
| Historical games not historical-only | 0 | 0.00% |

## Status Definitions

- READY: Derivable now from persisted historical tables with adequate coverage for descriptive historical intelligence.
- PARTIAL: Derivable now, but limited by one-season sample size, unresolved identity, missing pregame timing semantics or field-level incompleteness.
- BLOCKED: Requires data not present in the current historical database.
- FUTURE: Requires a new data source, parser expansion, model design or multi-season foundation.

## Feature Capability Matrix

| ID | Category | Feature | Description | Required tables | Required fields | Coverage | Status | Missing dependencies | Value | Complexity | Priority |
|---|---|---|---|---|---|---:|---|---|---|---|---|
| F01 | Pitchers | Starter workload baseline | Historical starter outs, batters faced, pitch count and runs allowed. | games, pitcher_appearances | starter, outs, batters_faced, pitch_count, runs | 99.97% | READY | None for descriptive use | High | M | P1 |
| F02 | Pitchers | Starter game-level form | Rolling starter hits, walks, strikeouts, runs and pitch counts. | games, pitcher_appearances | game_date, pitcher_source_id, hits, walks, strikeouts, runs | 100% | READY | Pregame cutoff policy before model use | High | M | P1 |
| F03 | Pitchers | Starter K/BB/run prevention rates | K%, BB%, hit rate and runs per out/batter faced. | pitcher_appearances | batters_faced, strikeouts, walks, hits, runs, outs | 100% | READY | None for audit | High | S | P1 |
| F04 | Pitchers | Pitch count fatigue signal | Prior pitch-count burden and short-rest fatigue proxy. | games, pitcher_appearances | game_date, pitcher_source_id, pitch_count | 99.97% | PARTIAL | Six missing pitch-count rows; pregame cutoff policy | High | M | P1 |
| F05 | Pitchers | Pitcher decision context | Win/loss/save and role context. | games, pitcher_appearances | decision, role, starter | 29.04% | READY | Save applies only when present; decision is outcome-biased | Medium | S | P3 |
| F06 | Pitchers | Starter rest days | Days since previous appearance/start. | games, pitcher_appearances | game_date, pitcher_source_id, starter | 100% | READY | Multi-season prior for early-season games | High | S | P1 |
| F07 | Pitchers | Pitcher opponent split | Pitcher historical outcomes by opposing team. | games, pitcher_appearances | pitcher_source_id, canonical teams, hits, walks, strikeouts, runs | 100% | READY | Sample-size guard | Medium | M | P2 |
| F08 | Pitchers | Pitch arsenal and velocity | Pitch mix, velocity and movement profile. | none current | pitch type, velocity, movement | 0% | FUTURE | Statcast or pitch-level parser/source | High | H | P4 |
| F09 | Batters | Batter slash-style production | PA, AB, hits, walks, HR, strikeouts and derived OBP-like rates. | batter_appearances | plate_appearance, at_bat, hit, walk, home_run, strikeout | 100% | READY | None for audit | High | S | P1 |
| F10 | Batters | Batter power indicators | HR rate, extra-base hit flags from single/double/triple/HR. | batter_appearances | single_hit, double_hit, triple_hit, home_run | 100% | READY | None for audit | High | S | P1 |
| F11 | Batters | Batter plate-discipline indicators | Walk and strikeout rates. | batter_appearances | walk, strikeout, plate_appearance | 100% | READY | None for audit | High | S | P1 |
| F12 | Batters | Batter base-running outcomes | Stolen-base and caught-stealing rates. | batter_appearances | stolen_base, caught_stealing | 100% | READY | Attempts not all base-running events | Medium | S | P2 |
| F13 | Batters | Batter run creation proxy | Runs and RBI from PA rows plus team run environment. | games, batter_appearances | runs, rbi, final_score | 100% | READY | RBI parser caveats need validation | Medium | M | P2 |
| F14 | Batters | Batter pitcher matchup history | Batter outcomes versus pitcher source IDs. | batter_appearances | batter_source_id, pitcher_source_id, PA outcomes | 100% | PARTIAL | Sparse sample sizes | Medium | M | P2 |
| F15 | Batters | Batter handedness split | Performance by batter/pitcher handedness. | none current | handedness | 0% | BLOCKED | Player handedness data | High | M | P2 |
| F16 | Batters | Batted-ball quality | Exit velocity, launch angle and hard-hit rate. | none current | Statcast quality-of-contact fields | 0% | FUTURE | Statcast | High | H | P4 |
| F17 | Bullpen | Bullpen usage volume | Reliever appearances and batters faced by team/game/date. | games, pitcher_appearances | role, team_side, batters_faced | 100% | READY | Team-date rollup service | High | M | P1 |
| F18 | Bullpen | Bullpen workload fatigue | Prior-day and rolling reliever pitch counts/outs. | games, pitcher_appearances | game_date, pitcher_source_id, role, pitch_count, outs | 99.97% | READY | Pregame cutoff policy | High | M | P1 |
| F19 | Bullpen | Bullpen effectiveness | Reliever K/BB/run/hit rates. | pitcher_appearances | role, strikeouts, walks, hits, runs, outs | 100% | READY | None for audit | High | M | P1 |
| F20 | Bullpen | Leverage proxy | Late-inning usage and close-score entry proxy. | plays, pitcher_appearances | entry_inning, score_after, role | 100% | PARTIAL | True leverage index not present | Medium | M | P2 |
| F21 | Bullpen | Closer availability | Save pitcher history and recent usage. | games, pitcher_appearances | save_pitcher_source_id, decision, pitch_count | 49.42% save games | PARTIAL | Role labels beyond save decision | Medium | M | P2 |
| F22 | Bullpen | Bullpen handedness mix | Left/right bullpen composition. | none current | pitcher handedness | 0% | BLOCKED | Player handedness data | Medium | M | P3 |
| F23 | Defense | Team defensive run prevention proxy | Runs allowed, outs recorded and pitcher support by team. | games, pitcher_appearances | final_score, team_side, outs, runs | 100% | PARTIAL | Separates pitching from defense poorly | Medium | M | P3 |
| F24 | Defense | Double-play prevention/creation proxy | GDP events by batter/team and fielding team. | batter_appearances, plays | grounded_into_double_play, half, teams | 100% | PARTIAL | Fielder credits not parsed | Low | M | P3 |
| F25 | Defense | Position-level defensive substitutions | Defensive replacement frequency by position. | substitutions, lineups | classification, field_position | 100% | BLOCKED | Defensive quality outcomes unavailable | Low | M | P4 |
| F26 | Defense | Fielder-specific defensive value | Errors, assists, putouts or OAA-style metrics. | none current | fielder outcomes | 0% | BLOCKED | Box score/fielding or Statcast defense | Medium | H | P4 |
| F27 | Defense | Catcher framing/blocking | Catcher defensive run value. | none current | catcher framing/blocking fields | 0% | FUTURE | Statcast/catcher source | Medium | H | P4 |
| F28 | Teams | Team run differential | Runs scored/allowed and margin by game. | games | final_score, canonical teams | 100% | READY | None for audit | High | S | P1 |
| F29 | Teams | Team offense baseline | Runs, hits, walks, HR, strikeouts by team. | games, batter_appearances | team side via half/game teams, PA outcomes | 100% | READY | Team-side aggregation | High | M | P1 |
| F30 | Teams | Team pitching baseline | Runs, hits, walks, K allowed by team. | pitcher_appearances | team_side, hits, walks, strikeouts, runs | 100% | READY | None for audit | High | M | P1 |
| F31 | Teams | Home/away split | Team outcomes at home and away. | games | home_team, away_team, final_score | 100% | READY | None for audit | High | S | P1 |
| F32 | Teams | Day/night split | Team outcomes by day/night. | games | day_night, final_score, teams | 100% | READY | None for audit | Medium | S | P2 |
| F33 | Teams | DH/rules context split | Team outcomes by DH flag. | games | designated_hitter, teams, final_score | 100% | PARTIAL | Single-season rule context only | Low | S | P4 |
| F34 | Teams | Extra-inning performance | Outcomes and scoring in games over nine innings. | games, plays | innings, score_after | 100% | READY | None for audit | Low | S | P3 |
| F35 | Teams | Team lineup continuity | Repeated starters/order stability by team. | games, lineups | player_source_id, team_side, batting_order, starter | 100% | READY | Canonical player resolution before cross-source use | Medium | M | P2 |
| F36 | Schedule | Rest-day count | Days since team last game. | games | game_date, teams | 100% | READY | Multi-season edge cases | High | S | P1 |
| F37 | Schedule | Doubleheader context | Game-number/doubleheader indicator. | games | game_number | 100% | READY | None for audit | Medium | S | P2 |
| F38 | Schedule | Series sequence | Same opponent/location consecutive-game context. | games | game_date, teams, venue | 100% | READY | Series parser needed | Medium | M | P2 |
| F39 | Schedule | Early/late start time context | Local start-time bucket. | games | start_time_local | 100% | PARTIAL | Time zone normalization for pregame use | Low | S | P3 |
| F40 | Schedule | Season phase | Month/week and late-season indicators. | games | game_date | 100% | PARTIAL | One season only | Medium | S | P3 |
| F41 | Travel | Consecutive road travel | Road-game sequence and city changes. | games | away_team, venue, game_date | 100% | BLOCKED | Venue geocoding/travel distance | Medium | M | P3 |
| F42 | Travel | Travel miles | Approximate miles between venues. | games plus external venue data | venue, coordinates | 0% | BLOCKED | Venue coordinates | Medium | M | P3 |
| F43 | Travel | Time-zone shift | Team travel time-zone changes. | games plus venue metadata | venue timezone | 0% | PARTIAL | Venue timezone table | Medium | M | P3 |
| F44 | Travel | Altitude/travel stress | High-altitude and long-trip stress. | games plus venue metadata | venue altitude, coordinates | 0% | BLOCKED | Venue metadata | Low | M | P4 |
| F45 | Weather | Temperature context | Team/game outcomes by temperature. | games | weather.temp | 100% object coverage | READY | Numeric normalization | Medium | S | P2 |
| F46 | Weather | Wind context | Outcomes by wind direction/speed. | games | weather.winddir, weather.windspeed | 100% object coverage | READY | Numeric normalization | Medium | S | P2 |
| F47 | Weather | Precipitation/sky context | Outcomes by precipitation and sky condition. | games | weather.precip, weather.sky | 100% object coverage | READY | Category normalization | Low | S | P3 |
| F48 | Weather | Weather-run environment interaction | Park/weather run scoring adjustment. | games | venue, weather, final_score | 100% object coverage | PARTIAL | One season sample | Medium | M | P2 |
| F49 | Park Factors | Park run factor | Venue run environment by game. | games | venue, final_score | 100% | READY | Multi-year sample for stability | High | S | P1 |
| F50 | Park Factors | Park HR factor | Venue HR environment. | games, batter_appearances | venue, home_run | 100% | READY | Multi-year sample for stability | High | M | P1 |
| F51 | Park Factors | Park handedness/shape factor | Park effect by batter/pitcher handedness. | games plus handedness | venue, handedness, outcomes | 0% | PARTIAL | Handedness data | Medium | M | P3 |
| F52 | Park Factors | Statcast park quality-of-contact factor | Park effect on xwOBA/hard contact. | none current | Statcast batted-ball data | 0% | FUTURE | Statcast | High | H | P4 |
| F53 | Umpires | Home-plate umpire run environment | Run scoring by home-plate umpire. | games | umpires.home, final_score | 100% object coverage | READY | Umpire name normalization | Medium | S | P2 |
| F54 | Umpires | Strikeout/walk tendency | K and BB rates by home-plate umpire. | games, batter_appearances | umpires.home, strikeout, walk | 100% object coverage | READY | Umpire normalization | High | M | P1 |
| F55 | Umpires | Umpire crew context | Crew-level scoring and pace context. | games | umpires.* | 100% object coverage | PARTIAL | Crew continuity model | Low | M | P4 |
| F56 | Umpires | Called-strike zone profile | Umpire zone size and location profile. | none current | pitch location/called strike | 0% | FUTURE | Pitch-level location data | High | H | P4 |
| F57 | Game State | Base-out run expectancy | Run expectancy by inning, half, outs and bases. | plays | inning, half, base_state_before, runs, score_after | 100% | READY | Run-to-end-of-inning derivation | High | M | P1 |
| F58 | Game State | Win-probability state proxy | Score, inning, half and base/out context. | plays, games | score_after, inning, half, outs, final_score | 100% | READY | Calibration before production use | High | M | P1 |
| F59 | Game State | Late-close performance | Team/bullpen performance in close late innings. | plays, games | inning, score_after, teams | 100% | READY | Leverage definition | Medium | M | P2 |
| F60 | Game State | Run-scoring event distribution | Frequency of run-scoring plays by state. | plays | runs, base_state_before, inning, half | 100% | READY | None for audit | Medium | S | P2 |
| F61 | Game State | Pitch-sequence pressure proxy | Count/pitch-sequence length and outcomes. | plays | count_text, pitch_sequence, parsed_event | 100% | PARTIAL | Pitch semantics are coarse | Medium | M | P3 |
| F62 | Lineups | Starting lineup continuity | Team order and player stability. | lineups, games | starter, batting_order, player_source_id, team_side | 100% | READY | Player identity resolution for cross-source use | High | M | P1 |
| F63 | Lineups | Batting-order production | Outcome rates by order slot. | lineups, batter_appearances | batting_order, batter_source_id, PA outcomes | 100% | READY | Join by player/game | Medium | M | P2 |
| F64 | Lineups | Defensive position usage | Player positional usage and changes. | lineups, substitutions | field_position, player_source_id | 100% | READY | Defensive quality unavailable | Low | S | P3 |
| F65 | Lineups | Pinch hitter/runner usage | Frequency and context of PH/PR substitutions. | substitutions, plays | classification, entry_inning, entry_half | 100% | PARTIAL | Outcome linkage after substitution | Low | M | P3 |
| F66 | Lineups | Confirmed pregame lineup availability | Whether known pregame lineup differs from final lineup. | none current | pregame lineup timestamp | 0% | PARTIAL | Pregame lineup source | High | M | P2 |
| F67 | Historical Matchups | Team head-to-head | Team outcomes versus opponent. | games | canonical teams, final_score | 100% | READY | Multi-season sample for stability | Medium | S | P2 |
| F68 | Historical Matchups | Batter-vs-pitcher | Batter PA outcomes versus pitcher. | batter_appearances | batter_source_id, pitcher_source_id, outcomes | 100% | READY | Sparse sample guard | Medium | M | P2 |
| F69 | Historical Matchups | Starter-vs-team | Starter outcomes by opponent. | games, pitcher_appearances | starter, teams, outcomes | 100% | PARTIAL | Sample size | Medium | M | P2 |
| F70 | Historical Matchups | Bullpen-vs-lineup profile | Reliever outcomes against opposing hitters. | pitcher_appearances, batter_appearances | role, pitcher_source_id, batter_source_id | 100% | PARTIAL | Sparse sample and handedness missing | Low | H | P3 |
| F71 | Rolling Metrics | Team rolling offense | Last N games runs, PA outcomes and power. | games, batter_appearances | game_date, teams, outcomes | 100% | READY | Cutoff policy before model use | High | M | P1 |
| F72 | Rolling Metrics | Team rolling pitching | Last N games runs/hits/walks/K allowed. | games, pitcher_appearances | game_date, team_side, outcomes | 100% | READY | Cutoff policy before model use | High | M | P1 |
| F73 | Rolling Metrics | Player rolling batting | Last N PA/game batter outcomes. | games, batter_appearances | game_date, batter_source_id, outcomes | 100% | READY | Player identity resolution for cross-source use | High | M | P1 |
| F74 | Rolling Metrics | Player rolling pitching | Last N appearance pitcher outcomes. | games, pitcher_appearances | game_date, pitcher_source_id, outcomes | 100% | PARTIAL | Role/starter segmentation and pitch-count gaps | High | M | P1 |
| F75 | Streaks | Team win/loss streak | Consecutive outcomes by team. | games | game_date, final_score, teams | 100% | READY | None for audit | Medium | S | P2 |
| F76 | Streaks | Team scoring streak | Consecutive high/low scoring games. | games | game_date, final_score, teams | 100% | READY | Threshold definition | Medium | S | P2 |
| F77 | Streaks | Batter hit/on-base streak | Consecutive games with hit/on-base event. | games, batter_appearances | game_date, batter_source_id, hit, walk | 100% | READY | Player identity resolution | Medium | M | P2 |
| F78 | Streaks | Pitcher scoreless/quality streak | Consecutive low-run appearances. | games, pitcher_appearances | game_date, pitcher_source_id, runs, outs | 100% | READY | Quality-start definition | Medium | S | P2 |
| F79 | Situational Baseball | Runners-on performance | Batter/team outcomes with base-state context. | plays, batter_appearances | base_state_before, batter_source_id, outcomes | 100% | READY | Join validation | Medium | M | P2 |
| F80 | Situational Baseball | Scoring position performance | Outcomes with runner on second/third. | plays, batter_appearances | base_state_before, outcomes | 100% | READY | Join validation | Medium | M | P2 |
| F81 | Situational Baseball | Late-inning offense | Team/batter outcomes by inning bucket. | plays, batter_appearances | inning, half, outcomes | 100% | READY | None for audit | Medium | M | P2 |
| F82 | Situational Baseball | Count-based outcome profile | Outcomes by count and pitch sequence. | plays | count_text, pitch_sequence, parsed_event | 100% | PARTIAL | Count parser needs baseball-specific validation | Medium | M | P3 |
| F83 | Situational Baseball | Clutch context proxy | Late/close/base-state outcomes. | plays, games | inning, score_after, base_state_before, final_score | 100% | PARTIAL | True leverage model not implemented | Medium | H | P3 |
| F84 | Player Trends | Batter hot/cold trend | Recent rolling PA outcomes versus season baseline. | games, batter_appearances | game_date, batter_source_id, outcomes | 100% | READY | Cutoff policy | High | M | P1 |
| F85 | Player Trends | Pitcher hot/cold trend | Recent pitcher outcomes versus season baseline. | games, pitcher_appearances | game_date, pitcher_source_id, outcomes | 100% | READY | Cutoff policy | High | M | P1 |
| F86 | Player Trends | Usage trend | Player starts, appearances and substitution usage over time. | games, lineups, substitutions | game_date, player_source_id, starter, classification | 100% | READY | Canonical identity for cross-source use | Medium | M | P2 |
| F87 | Player Trends | Injury/availability trend | Missed starts or sudden absence proxy. | lineups, games | historical lineups over time | 100% | PARTIAL | True injury source missing | Medium | M | P3 |
| F88 | Player Trends | Player fatigue trend | Recent workload for pitchers and catchers/position players. | lineups, pitcher_appearances | pitch_count, starts, appearances | 99.97% | PARTIAL | Position-specific fatigue assumptions | Medium | M | P2 |
| F89 | Team Trends | Team form trend | Rolling run differential and win rate. | games | game_date, teams, final_score | 100% | READY | Cutoff policy | High | S | P1 |
| F90 | Team Trends | Team offense trend | Rolling team PA outcomes. | games, batter_appearances | game_date, teams, outcomes | 100% | READY | Team-side derivation | High | M | P1 |
| F91 | Team Trends | Team pitching trend | Rolling team pitcher outcomes. | games, pitcher_appearances | game_date, team_side, outcomes | 100% | READY | Team-side derivation | High | M | P1 |
| F92 | Team Trends | Team bullpen trend | Rolling bullpen workload/effectiveness. | games, pitcher_appearances | role, game_date, team_side, pitch_count, outcomes | 99.97% | READY | Role segmentation | High | M | P1 |
| F93 | Team Trends | Team situational trend | Rolling late/close/RISP/base-state outcomes. | games, plays, batter_appearances | game_date, score_after, base_state_before, outcomes | 100% | PARTIAL | Leverage definitions and joins | Medium | H | P2 |

## Catalog Totals

| Status | Count |
|---|---:|
| READY | 57 |
| PARTIAL | 24 |
| BLOCKED | 7 |
| FUTURE | 5 |
| Total candidate features | 93 |

## Top 25 Highest-Value Features

1. F01 Starter workload baseline
2. F03 Starter K/BB/run prevention rates
3. F04 Pitch count fatigue signal
4. F06 Starter rest days
5. F17 Bullpen usage volume
6. F18 Bullpen workload fatigue
7. F19 Bullpen effectiveness
8. F28 Team run differential
9. F29 Team offense baseline
10. F30 Team pitching baseline
11. F31 Home/away split
12. F36 Rest-day count
13. F49 Park run factor
14. F50 Park HR factor
15. F54 Umpire strikeout/walk tendency
16. F57 Base-out run expectancy
17. F58 Win-probability state proxy
18. F62 Starting lineup continuity
19. F71 Team rolling offense
20. F72 Team rolling pitching
21. F73 Player rolling batting
22. F74 Player rolling pitching
23. F84 Batter hot/cold trend
24. F85 Pitcher hot/cold trend
25. F89 Team form trend

## Estimated Prediction Impact

These estimates are directional and are not model-performance claims.

| Bundle | Expected impact | Reason |
|---|---|---|
| Pitcher workload and form | High | Starting pitcher and recent workload are among the most baseball-specific signals available from current tables. |
| Bullpen workload/effectiveness | High | Relief usage and fatigue often explain late-game run prevention and moneyline/total movement. |
| Team rolling offense/pitching | High | Broad, stable signal with complete coverage. |
| Park/weather/umpire run environment | Medium to High | Strong contextual modifiers, especially for totals and HR-sensitive markets. |
| Lineup continuity and player trends | Medium to High | Valuable once pregame lineup availability and canonical identity policy are defined. |
| Situational/base-out intelligence | Medium | Rich explanatory value; predictive use needs leakage-safe cutoff design. |
| Travel/rest schedule | Medium | Rest is ready; distance/time-zone signals need venue metadata. |
| Defense | Low to Medium | Current tables support only proxies; true fielding quality is blocked. |
| Player props | Medium now, High later | PA/pitcher workload foundations are strong, but prop lines, handedness, confirmed lineups and eligibility rules are missing. |

## Priority Roadmap

### P1: Coverage-Ready Descriptive Historical Intelligence

- Build read-only historical aggregate services for pitcher workload, bullpen workload, team rolling offense/pitching, team form, park run factor, park HR factor and lineup continuity.
- Keep all outputs labeled historical/postgame-only.
- Add no prediction feature rows and no training datasets.

### P2: Leakage-Safe Replay Planning

- Define a cutoff policy for using only games before a historical prediction timestamp.
- Define sample-size guards for batter-vs-pitcher, starter-vs-team, umpire and park splits.
- Add a historical replay plan document before implementation.

### P3: Context Normalization

- Normalize weather fields, umpire names, venues, start times and series identifiers.
- Add venue metadata planning for travel, time zone and altitude.
- Add player identity resolution plan before cross-source player features.

### P4: External Dependency Expansion

- Evaluate approved sources for handedness, Statcast, pitch-level data, fielding data, pregame confirmed lineups, injuries and player prop lines.
- Do not activate unsupported markets until ingestion, settlement, replay, validation and dashboard support are complete.

## Dependency Graph

```text
historical_source_registry
  -> historical_raw_records
  -> historical_baseball_games
      -> team/date/venue/weather/umpire/schedule features
      -> historical_baseball_lineups
          -> lineup continuity, batting-order, player usage features
      -> historical_baseball_substitutions
          -> bullpen usage, pinch-hitter, pinch-runner, defensive-substitution context
      -> historical_baseball_plays
          -> game state, base-out, count, scoring, situational features
      -> historical_baseball_pitcher_appearances
          -> starter, bullpen, workload, pitching trend features
      -> historical_baseball_batter_appearances
          -> batter production, matchup, player trend, situational batting features
      -> historical_identity_foundation
          -> source-stable team/event/player identity, unresolved-player review

External dependencies for blocked/future capabilities:
  handedness -> batter/pitcher splits, bullpen handedness, park handedness factors
  venue metadata -> travel miles, time zones, altitude
  Statcast/pitch-level -> arsenal, velocity, pitch location, quality of contact, fielding/catcher value
  pregame sources -> pregame lineups, injuries, betting lines, prop lines
```

## Implementation Recommendations

### Prediction Engine V5

Do not implement in Phase 1.5. Recommended future order:

1. Add a read-only feature-planning contract that maps P1 features to leakage-safe cutoff requirements.
2. Build historical replay fixtures before model consumption.
3. Require explicit promotion from historical-only rows into a separate immutable feature snapshot table with `training_eligible` and `pregame_eligible` gates.
4. Keep market recommendations disabled until replay, calibration, settlement and validation are complete.

### Learning Brain

Do not ingest Retrosheet data yet. Recommended future order:

1. Use only finalized, leakage-safe replay outputs, not raw historical tables.
2. Separate descriptive historical intelligence from learning feedback.
3. Require explicit model version lineage and immutable feature snapshots before any learning loop.

### Historical Replay

Recommended first implementation target after this audit:

1. Replay scheduler over 2025 games using pregame cutoff windows.
2. P1 feature bundles only: pitcher workload/form, bullpen workload, team rolling form, park/weather/umpire context.
3. Strict holdout/date-order validation and no Current Board/Official Pick mutation.

### Player Props

Do not activate props. Current support:

- Pitcher outs, pitch-count workload and batter PA trend foundations are promising.
- Blockers remain: prop lines, confirmed pregame lineups, player handedness, starter confirmation timing, settlement rules and dashboard separation.

### Bullpen Engine

Best near-term domain. Current tables support:

- Prior-day workload
- Rolling reliever pitch count and outs
- Team bullpen effectiveness
- Close/late usage proxy

Blockers:

- Handedness mix
- True leverage index
- Pregame availability rules

### Matchup Engine

Recommended after P1 aggregates:

- Team head-to-head, starter-vs-team, batter-vs-pitcher and bullpen-vs-lineup profiles are derivable.
- Must use sample-size warnings and avoid over-weighting sparse matchups.
- Handedness and Statcast would materially improve this engine but are not required for a first descriptive version.

## Stop Condition

Phase 1.5 stops at this documentation audit. No prediction features, model inputs, training datasets, Learning Brain mutations, Current Board changes, Official Pick changes, market-pipeline changes or production behavior changes were implemented.

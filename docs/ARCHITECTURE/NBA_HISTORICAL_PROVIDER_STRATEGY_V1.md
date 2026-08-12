# NBA Historical Provider Strategy V1

Status: `NBA_HISTORICAL_BOOTSTRAP_READY_PENDING_STAT_SOURCE_ACCESS`

NBA-01A defines the historical provider strategy for NBA without activating NBA production, calling paid providers, importing bulk history or generating replay predictions.

## Source Decision

| Domain | Primary Source | Secondary Source | Status |
| --- | --- | --- | --- |
| Current odds | The Odds API, `basketball_nba` | None required | approved target, not activated for NBA production |
| Historical prices | The Odds API historical odds | owned legacy/trial rows for reference only | budget authorization required before import |
| Schedule | NBA Stats public endpoints through an approved client/header contract | BALLDONTLIE only if paid access is approved | access/terms review required before bulk import |
| Status | NBA Stats public endpoints | BALLDONTLIE only if paid access is approved | access/terms review required |
| Results | NBA Stats scoreboard/game logs/boxscore summary | BALLDONTLIE only if paid access is approved | access/terms review required |
| Quarter scores | NBA Stats scoreboard/boxscore line score | BALLDONTLIE paid tier if approved | access/terms review required |
| Boxscores | NBA Stats boxscore endpoints | BALLDONTLIE GOAT tier if approved | access/terms review required |
| Team stats | NBA Stats league game log / boxscore team stats | BALLDONTLIE paid tier if approved | access/terms review required |
| Player stats | NBA Stats boxscore/player game logs | BALLDONTLIE paid tier if approved | access/terms review required |
| Lineups | NBA Stats boxscore start position where available | paid source if needed | secondary, not core replay blocker for ML/spread/total |
| Injuries | not selected for historical backfill | paid source if later approved | forward-only soft context |

## The Odds API Contract

| Item | Certified Value |
| --- | --- |
| Sport key | `basketball_nba` |
| Sport title | NBA |
| Current core endpoint | `/v4/sports/basketball_nba/odds` |
| Current event odds endpoint | `/v4/sports/basketball_nba/events/{eventId}/odds` |
| Historical odds endpoint | `/v4/historical/sports/basketball_nba/odds` |
| Historical events endpoint | `/v4/historical/sports/basketball_nba/events` |
| Core market keys | `h2h`, `spreads`, `totals` |
| First-half examples | `h2h_h1`; spread/total period keys require bounded provider-market validation before use |
| Player prop examples | `player_points`, `player_rebounds`, `player_assists`, `player_points_rebounds_assists`, `player_threes`, `player_blocks`, `player_steals`, `player_double_double` |
| Core historical start | mid-2020 / June 2020 class; exact account entitlement must be confirmed before import |
| Additional-market historical start | May 2023 class; exact market/book availability must be confirmed before import |
| Scores role | current/recent result support only; not suitable as deep historical result authority |

## Historical Snapshot Semantics

The v4 historical odds endpoint returns the closest available snapshot equal to or earlier than the requested ISO timestamp. Responses include `timestamp`, `previous_timestamp` and `next_timestamp`. Bookmaker and market rows include provider update timestamps. Replay must bind to the returned snapshot timestamp, not the requested timestamp, and must require `snapshot.timestamp < commence_time`.

## Credit Formula

Conservative v4 formula:

```text
historical odds credits = 10 x markets x regions x requested timestamps
current odds credits = markets x regions
```

The public pricing pages also describe Business archive access. NBA-01A uses the conservative v4 request-credit formula until the actual account entitlement proves zero incremental historical archive cost. No historical request is allowed until this is confirmed or explicitly budget-approved.

## Core Historical Cost Model

Assumptions:

- Region: `us`.
- Core markets: `h2h,spreads,totals`.
- Credit cost per historical timestamp: `10 x 3 x 1 = 30`.
- Certified book set: FanDuel, DraftKings, BetMGM, Caesars when present. Book filtering is a storage/query decision unless the provider account proves credit reduction by bookmaker filter.
- First executable season: 2024-25 regular season, approximately 1,230 games.
- Game-day count estimate for a regular season: approximately 170 NBA game dates.

| Strategy | Requests / Season | Credits / Request | Credits / Season | Use |
| --- | ---: | ---: | ---: | --- |
| One daily card snapshot | 170 | 30 | 5,100 | cheapest initial price-aware cohort; one pregame card price per day |
| Two daily card snapshots | 340 | 30 | 10,200 | early plus near-close approximation |
| Three daily card snapshots | 510 | 30 | 15,300 | open/mid/close approximation |
| Per-game near-close snapshot | 1,230 | 30 | 36,900 | strongest closing-line cohort; requires explicit budget |
| Two per-game snapshots | 2,460 | 30 | 73,800 | line movement study |
| Three per-game snapshots | 3,690 | 30 | 110,700 | open/mid/close by event |

Recommended initial historical odds plan: `ONE_DAILY_CARD_SNAPSHOT` for the first season only after budget approval, then selectively add event-specific near-close snapshots for a smaller calibration cohort if credits permit.

## Period And Prop Cost Model

Period and player-prop markets are event-odds style and more expensive operationally because they must be event-scoped and market-expanded.

| Domain | Historical Status | Cost Classification | NBA-01A Decision |
| --- | --- | --- | --- |
| First half | supported examples exist; historical availability requires validation | secondary import | defer until core replay passes |
| Quarter markets | support indicated by provider NBA market docs; exact keys require validation | secondary/forward | defer |
| Player props | current Business-tier coverage indicated | expensive | no historical backfill; forward-only later |

## Stat Source Candidate Review

| Candidate | Strengths | Weaknesses | Classification |
| --- | --- | --- | --- |
| NBA Stats public endpoints via `nba_api` style client | official-ish NBA identity, stable `GAME_ID`, teams, players, scoreboard, league game logs, boxscores, period lines | no formal project-specific bulk-use approval yet; rate/blocking behavior must be certified | `NBA_STAT_SOURCE_PRIMARY_PENDING_ACCESS_REVIEW` |
| BALLDONTLIE | documented paid NBA API, games, players, stats, advanced stats, boxscores and standings depending on tier | game player stats, boxscores, lineups and standings require paid tiers; no new paid subscription authorized | `SECONDARY_PAID_APPROVAL_REQUIRED` |
| Existing owned/trial database | already mapped into Pick Analyzer tables | incomplete sample only, not full season | `OWNED_PARTIAL_REFERENCE` |
| SportsDataIO NBA | existing trial evidence only | paid expansion forbidden | `DO_NOT_EXPAND` |

## Target Seasons

| Cohort | Seasons | Reason |
| --- | --- | --- |
| `MODEL_REPLAY_HISTORY` | 2024-25 regular season first; 2025-26 forward collection after activation | minimizes scope while proving full schedule/result/stat/feature reconstruction |
| `PRICE_AWARE_HISTORY` | 2024-25 regular season first after The Odds API budget approval | core historical odds are available for this period; price-aware cohort can be partial |
| `PERIOD_MARKET_HISTORY` | deferred | requires period market keys and period-score completeness |
| `PROP_HISTORY` | deferred | too expensive and unsupported by current settlement/replay scope |

## Import Order

Every import step must be checkpoint/resume capable with deterministic idempotency keys. A failed batch resumes from the last certified season/date cursor rather than restarting completed history.

1. Seasons.
2. Teams and aliases.
3. Players and official IDs.
4. Games and status.
5. Results and final scores.
6. Period scores.
7. Boxscores.
8. Team-game stats.
9. Player-game stats.
10. Provider mappings and crosswalks.
11. Historical odds snapshots.
12. Pregame feature reconstruction.
13. NBA-02 dry-run replay validation.

## NBA-02 Preparation

NBA-02 should execute only after the stat-source access boundary is cleared and the first season is imported. The first NBA-02 replay cohort should be:

| Item | Value |
| --- | --- |
| Seasons | 2024-25 regular season |
| Target games | approximately 1,230 |
| Markets | Moneyline, Spread, Total |
| Expected predictions | approximately 3,690 |
| Feature policy | pregame-only, chronological, no target-game final stats |
| Price policy | bind historical prices only when legitimate pregame snapshot exists |
| Settlement | exact line identity, overtime included for full-game totals/spreads |
| Current Era isolation | no NBA Current Board, Official Picks, Performance default or production learning activation |

## Stop Boundaries

- `PROVIDER_ACCESS_AUTHORIZATION_REQUIRED`: before bulk NBA Stats public endpoint use.
- `EXPLICIT_BUDGET_AUTHORIZATION_REQUIRED`: before The Odds API historical odds import.
- `PAID_STAT_SUBSCRIPTION_AUTHORIZATION_REQUIRED`: before BALLDONTLIE or any paid stat source.
- `DB_MIGRATION_AUTHORIZATION_REQUIRED`: before schema/index changes.
- `NBA_PRODUCTION_ACTIVATION_NOT_AUTHORIZED`: no scheduler, Current Board or Official Picks activation in NBA-01A.

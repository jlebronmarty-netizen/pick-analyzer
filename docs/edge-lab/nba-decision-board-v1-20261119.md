# NBA Decision Board V1 (2026-11-19) — research-only private Preview

## Objective
Replace daily Excel workflows with one readable NBA page: Top 25, Moneyline, Spread, Total, Player props, and Cuartos/Mitades. Read only existing certified archives, no provider calls or production-model changes. Design shared card vocabulary for future sport adapters.

## Data contracts
- NBA day and team IDs from today's nba_market_schedules_v1 snapshot (BALLDONTLIE; local date America/Puerto_Rico).
- GOAT main and prop quotes from nba_market_quotes_v1: most recent main market price by game/side; for props the latest complete snapshot per game. Both sides are preserved. yes/milestones and Q1 props without matching history are intentionally not projected.
- Histories of team quarters/OT come from a verified complete GOAT history archive in nba_market_sync_runs_v1, with full 4Q+OT reconciliation against final score; only games before the target date enter L5/L10.
- Player stats: nba_goat_player_game_research_v1 filtered by exact GOAT player IDs, pregame historical game datetime and source captured before asOf, minimum 10 played minutes. Team identity is checked against current game.
- Player display names: only first/last names in previously saved GOAT player boxscores; unresolved identities retain provider ID and cannot be treated as verified names.
- HoopsAPI periods from newest immutable archive in nba_hoopsapi_captures_v1; never merge ID namespaces by numeric value. Strict normalized home/away team names, matching start within 30 minutes, verified timezone and unique crosswalk.
- Main NBA GAME quotes from GOAT preferred; HoopsAPI FT fills absent sides only. Q1–Q4 and H1/H2 from HoopsAPI.
- Use 40% L5 + 60% L10, split 50% team offense + 50% opponent permitted, for period/game projections; player singles use 65% L5 + 35% L10 and combinations 40/60. These are exploratory descriptive formulas, not validated model wins or official recommendations.
- Freshness labels with a timestamp (180 minutes GOAT, 360 minutes Hoops). No substitute quote, no prices invented. FanDuel Puerto Rico bettability unverified.
- When models or contracts lack evidence, mark PASAR, not PICK. Top 25 means up to 25 research opportunities, not 25 guaranteed winners, ranked by historical/sample/gap quality and never marketed as calibrated probability.
- Never derive mathematical edge/EV from a points gap alone. Store probability and expectedValue as null until separately validated.

## Accuracy / learning
- Board shows already-settled GOAT prediction_history CURRENT_ERA_SHADOW results per moneyline, spread and total. Displays n, win rate and projection MAE with explicit small-sample warning. Does not pretend those settle HoopsAPI periods or props.
- Version NBA_DECISION_BOARD_SHADOW_V1. Promotion to production champion requires prospective pre-tipoff frozen exact price, date/time, target outcome, verified teams/lineups/contracts, independent holdout and human review. Never overwrite official rows.
- Next phase: separate append-only prospective shadow forecasts and immutable outcomes tied to provider quote ID, evaluate against final game/quarter stats, and register challenger proposals rather than auto-changing weights. Future cron should be independent, quota-safe and produce zero new provider calls.

## Routes
- Protected Preview-only: /nba-decision-board and GET /api/nba/decision-board.
- API requires the existing Vercel OIDC function token and rejects query parameters; no public endpoint or model write.
- Production /nba redirect and existing /nba-market-data remain untouched.
- No additional subscription or API credit use.

## Caveats
- GOAT player history currently only ~5,323 stored rows through 2026-11-15; no phantom data. 210 complete NBA finals in stored archive through 2026-11-17; current-day history may lag.
- Use 30-minute exact-hour crosswalk only when provider home/away sides match; otherwise exclude HoopsAPI rows and report missing identity.
- No cross-sport side effects. This is first sport-specific adapter; reusable board UI patterns are intended for NHL, NCAAB etc once their own contract/settlement models are certified.
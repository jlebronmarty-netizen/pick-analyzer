# MLB Provider Market-Key Audit — 2026-09-21

State: `RESEARCH_ONLY_NO_PROMOTION`

## Purpose

Close the ambiguity between:

1. a market key being officially supported by an upstream provider; and
2. this project actually possessing historical sportsbook rows for that key.

No model, threshold, Official Pick, APOSTAR, production eligibility, or historical outcome was changed by this audit.

## Canonical local readback

Supabase project: `ynuocvexviorgdjrfthw`.

A direct read of `public.sports_odds_snapshots` on 2026-09-21 returned **0 MLB rows** for every exact key below:

### Period moneyline

- `h2h_1st_1_innings`
- `h2h_1st_3_innings`
- `h2h_1st_5_innings`
- `h2h_1st_7_innings`

### Period 3-way moneyline

- `h2h_3_way_1st_1_innings`
- `h2h_3_way_1st_3_innings`
- `h2h_3_way_1st_5_innings`
- `h2h_3_way_1st_7_innings`

### Period spreads

- `spreads_1st_1_innings`
- `spreads_1st_3_innings`
- `spreads_1st_5_innings`
- `spreads_1st_7_innings`

### Alternate period spreads

- `alternate_spreads_1st_1_innings`
- `alternate_spreads_1st_3_innings`
- `alternate_spreads_1st_5_innings`
- `alternate_spreads_1st_7_innings`

### Period totals

- `totals_1st_1_innings`
- `totals_1st_3_innings`
- `totals_1st_5_innings`
- `totals_1st_7_innings`

### Alternate period totals

- `alternate_totals_1st_1_innings`
- `alternate_totals_1st_3_innings`
- `alternate_totals_1st_5_innings`
- `alternate_totals_1st_7_innings`

### Team totals

- `team_totals`
- `alternate_team_totals`

Therefore local state remains:

`BLOCKED_HISTORICAL_LINE_COVERAGE`

The blocker is not an unknown API key name anymore; it is missing event-level historical sportsbook evidence.

## The Odds API — official current documentation

Official market catalog:

`https://the-odds-api.com/sports-odds-data/betting-markets.html`

Official V4 API guide:

`https://the-odds-api.com/liveapi/guides/v4/`

Official historical data guide:

`https://the-odds-api.com/historical-odds-data/`

Verified 2026-09-21:

- all 1/3/5/7 inning moneyline, 3-way moneyline, spread, alternate spread, total, and alternate-total keys listed above are officially supported for baseball;
- `team_totals` and `alternate_team_totals` are official additional-market keys;
- historical additional markets, including period and alternate markets, are available after **2023-05-03T05:30:00Z**;
- historical events endpoint costs **1 credit** when an event is found;
- historical event-markets endpoint costs **1 credit**;
- historical event-odds costs **10 x unique markets returned x regions**.

This means the existing bounded discovery design remains appropriate:

1. historical events lookup;
2. historical event-markets lookup;
3. do **not** request historical event odds until event-level market availability is proven.

## The Odds API quota readback

Latest canonical operational ledger read on 2026-09-21:

- credits remaining: **2,905**
- reserve: **2,000**
- latest operational call cost: **1**

The existing PR #166 execution workflow did **not** spend credits because GitHub Actions did not have `THE_ODDS_API_KEY`; its provider call step was skipped.

No historical Odds API credit was consumed by this audit.

## BALLDONTLIE GOAT — official MLB documentation

Official MLB documentation:

`https://mlb.balldontlie.io/`

Verified 2026-09-21:

### Opening game odds

Endpoint:

`GET https://api.balldontlie.io/mlb/v1/odds/opening`

- requires GOAT;
- historical opening odds coverage is limited to the most recently completed season and ongoing seasons where available.

### Opening player props

Endpoint:

`GET https://api.balldontlie.io/mlb/v1/odds/player_props/opening`

- requires GOAT;
- MLB player-prop data begins in 2026;
- supported examples include hits, HR, total bases, RBI, stolen bases, singles, doubles, triples, walks, batter strikeouts, runs scored, HRRBI, pitcher strikeouts, pitcher outs, pitcher hits allowed, pitcher walks, pitcher earned runs, and pitcher record a win;
- vendors include BetMGM, BetRivers, Caesars, DraftKings, Fanatics, and FanDuel.

### Complete current market catalog

Endpoint:

`GET https://api.balldontlie.io/mlb/v1/odds/markets`

- complete current market catalogs are documented for DraftKings and FanDuel;
- keys are open-ended and can include game, team, inning, player, comparison, milestone, and other structures;
- this is the preferred no-Odds-API-credit source for discovering **current** MLB market structures when `BALLDONTLIE_API_KEY` is available in runtime.

## Credential/runtime state

Current known state:

- active subscriptions: BALLDONTLIE GOAT + The Odds API;
- no new SportsDataIO calls are authorized;
- GitHub Actions: `THE_ODDS_API_KEY` absent in PR #166 execution environment;
- BALLDONTLIE runtime key placement remains unverified by an executable MLB market-catalog probe;
- secrets must not be printed or copied into repository files.

## Research disposition

The exact provider market keys are now documented and no longer a research unknown.

Remaining blockers are:

1. prove event-level 2025 availability for the desired period/team-total markets;
2. recover actual historical points/prices only for markets shown available;
3. preserve sportsbook, side, line, price, and timestamp;
4. keep period reference-line studies distinct from real sportsbook-line backtests;
5. do not spend historical event-odds credits before the 1+1 credit market-discovery gate succeeds.

No threshold hunting is authorized merely because the provider catalog is now known.

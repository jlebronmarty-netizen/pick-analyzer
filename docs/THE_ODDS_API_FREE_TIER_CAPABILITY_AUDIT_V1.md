# The Odds API Free-Tier Capability Audit V1

Status: Locally implemented and live-audited.

Date: 2026-07-26

## Scope

This was a bounded capability audit of the existing The Odds API runtime credential. It did not change production behavior, enable scheduled ingestion, persist provider rows, call historical endpoints, calculate EV/Kelly or create recommendations.

## Exact Calls Made

Total provider calls: 15.

Sanitized endpoints:

- `GET /v4/sports/baseball_mlb/events`
- `GET /v4/sports/baseball_mlb/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=pitcher_outs&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=pitcher_strikeouts&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=pitcher_walks&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=pitcher_hits_allowed&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=pitcher_earned_runs&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=batter_hits&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=batter_total_bases&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=batter_home_runs&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=batter_rbis&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=batter_runs_scored&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=batter_walks&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=batter_strikeouts&oddsFormat=american`
- `GET /v4/sports/baseball_mlb/events/{eventId}/odds?regions=us&markets=batter_stolen_bases&oddsFormat=american`

No API key, authorization header or secret value is documented.

## Quota Evidence

- Requests remaining before audit: 20000
- Requests remaining after audit: 19985
- Requests used from provider header delta: 15
- Last request cost: 1

The observed provider quota is higher than the originally assumed 500 monthly credits. The application should still keep hard call caps until the plan is explicitly verified outside this audit.

## MLB Events

- Current MLB provider events found: 14
- Event payloads included provider event ID, commence time, home team and away team.

## Standard Markets

- `h2h`: `AVAILABLE_WITH_ROWS`, 260 outcome rows
- `spreads`: `AVAILABLE_WITH_ROWS`, 206 outcome rows
- `totals`: `AVAILABLE_WITH_ROWS`, 268 outcome rows

Observed standard-market bookmakers:

- `betmgm`
- `betonlineag`
- `betrivers`
- `betus`
- `bovada`
- `draftkings`
- `fanatics`
- `fanduel`
- `lowvig`
- `mybookieag`
- `williamhill_us`

## Player Prop Markets

- `pitcher_outs`: `AVAILABLE_WITH_ROWS`, 26 rows
- `pitcher_strikeouts`: `AVAILABLE_WITH_ROWS`, 26 rows
- `pitcher_walks`: `AVAILABLE_WITH_ROWS`, 8 rows
- `pitcher_hits_allowed`: `AVAILABLE_WITH_ROWS`, 14 rows
- `pitcher_earned_runs`: `AVAILABLE_WITH_ROWS`, 10 rows
- `batter_hits`: `AVAILABLE_WITH_ROWS`, 128 rows
- `batter_total_bases`: `AVAILABLE_WITH_ROWS`, 152 rows
- `batter_home_runs`: `AVAILABLE_WITH_ROWS`, 88 rows
- `batter_rbis`: `AVAILABLE_WITH_ROWS`, 92 rows
- `batter_runs_scored`: `AVAILABLE_WITH_ROWS`, 72 rows
- `batter_walks`: `AVAILABLE_WITH_ROWS`, 88 rows
- `batter_strikeouts`: `AVAILABLE_NO_CURRENT_ROWS`, 0 rows
- `batter_stolen_bases`: `AVAILABLE_WITH_ROWS`, 57 rows

## Pitcher Outs

`pitcher_outs` returned real current rows.

Bookmakers returning pitcher outs:

- `betmgm`
- `betonlineag`
- `betrivers`
- `bovada`
- `draftkings`
- `fanatics`
- `fanduel`
- `williamhill_us`

The returned rows included event ID, market key, bookmaker key, last update, player description/name, line, over/under outcome and American price fields sufficient for normalization candidates.

## Crosswalk Result

The audit compared returned MLB provider events against existing `sport_events` and `provider_entity_mappings` without persisting mappings.

- Exact matches: 0
- Probable team/time matches: 0
- Unmatched provider events: 14
- Unmatched internal events in the inspected window: 22
- Ambiguities: 0

Blocker: `ODDS_API_EVENT_CROSSWALK_NOT_PROVEN`.

The current The Odds API event IDs cannot be treated as reliably crosswalked to Pick Analyzer `sport_events` yet.

Update: `docs/THE_ODDS_API_EVENT_CROSSWALK_AND_PROP_SYNC_V1.md` adds the follow-up current-event crosswalk. The root cause was confirmed as provider-ID mismatch plus team-name representation mismatch and no existing `the-odds-api` event mappings. A bounded live review found deterministic team/time matches for current MLB events, and approved persist mode wrote only certified event mappings into `provider_entity_mappings`. This resolves the current-event crosswalk blocker for the reviewed mapped slate only; it does not prove historical odds, scheduled ingestion, settlement, replay, EV, Kelly, Official Picks or Portfolio Intelligence.

## Provider Replacement Implications

The existing The Odds API credential is valid and sufficient for tightly bounded live-development audits of current standard MLB odds and current event-level player props, including pitcher outs.

The free/current plan evidence does not justify replacing SportsDataIO as a full platform provider by itself because unresolved capabilities remain:

- Durable event ID crosswalk into canonical `sport_events`
- Historical odds access was intentionally not tested
- Historical player-prop availability was not tested
- Settlement and replay coverage for player props is not complete
- Scheduled ingestion, cache strategy and provider budget ledgers remain unapproved

## Historical Plan

A paid historical plan appears potentially justified only if the next approved phase requires backtesting/replay of player-prop lines or opening/closing line movement. This audit did not call historical endpoints and does not prove historical depth.

## Safety Result

- Provider calls: 15
- Remote mutations: 0
- Rows persisted: 0
- Historical endpoints: 0
- Scheduled sync changes: 0
- Recommendation logic changes: 0
- Current Board changes: 0
- Probability Picks changes: 0

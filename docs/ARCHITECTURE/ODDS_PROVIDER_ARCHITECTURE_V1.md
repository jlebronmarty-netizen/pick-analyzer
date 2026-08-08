# Odds Provider Architecture V1

Status: ODDS-01 audit artifact  
Date: 2026-08-08  
Starting commit: `a9879543a94fc5817cfe1d1da82a16e7c2c2ca3a`

## Current Architecture

Pick Analyzer currently uses SportsDataIO as the active MLB odds provider for production Current Board pricing.

Runtime path:

1. Vercel Cron or GitHub fallback invokes the protected operating-day endpoint.
2. Adaptive planner selects `REFRESH_MARKET` for eligible pregame MLB events.
3. Canonical acquisition calls SportsDataIO with one date-level request:
   `/api/mlb/odds/json/GameOddsByDate/{date}`.
4. `normalizeSportsDataIoMlbGameOdds` maps provider rows to `sports_odds_snapshots`.
5. Current Board binds stored odds snapshots to prediction rows.
6. Product Freshness SLA evaluates actionability from the provider/source market timestamp, not the page or scheduler timestamp.

Primary runtime files:

| Area | File | Responsibility |
| --- | --- | --- |
| Planner and operating-day selection | `src/services/adaptive-refresh-orchestrator.service.ts` | Determines whether market refresh, result sync or settlement closure should run. |
| Canonical acquisition | `src/services/canonical-acquisition.service.ts` | Executes the active SportsDataIO date-level MLB odds refresh with budget checks and deduplication. |
| SportsDataIO normalization | `src/services/sportsdataio-mlb-normalization.service.ts` | Converts `PregameOdds` into sportsbook, market, selection, line, price and timestamp rows. |
| Endpoint catalog | `src/config/sportsdataio-endpoint-catalog.ts` | Documents available and reserved SportsDataIO endpoints. |
| Current Board binding | `src/services/current-board.service.ts` | Selects direct or complement canonical prices from stored odds snapshots. |
| Actionability freshness | `src/services/product-freshness-sla.service.ts` | Blocks stale provider/source evidence for decision-critical surfaces. |
| Provider budget | `src/services/provider-budget.service.ts` | Tracks SportsDataIO budget separately from other providers. |

## Current SportsDataIO Endpoint

Current active endpoint:

`GET https://api.sportsdata.io/api/mlb/odds/json/GameOddsByDate/{YYYY-MM-DD}`

Current request granularity: `DATE`

Current active markets:

- Moneyline
- Run Line
- Total

Current inactive or reserved odds endpoints in the repository:

- `/api/mlb/odds/json/GameOddsLineMovement/{gameid}`
- Discovery/catalog references for enterprise `/v3/mlb/odds/json/GameOddsByDate/{date}`
- Enterprise/catalog references for alternate markets, betting events, betting markets, player props and betting results

No runtime code in ODDS-01 changes provider, endpoint, credentials, cadence, budget, prediction logic, Official Pick policy, settlement or learning.

## Timestamp Contract

There are two distinct timestamp concepts:

| Concept | Meaning | Used For |
| --- | --- | --- |
| Provider/source market timestamp | The provider row's own `Updated` or `Created` timestamp, normalized to ISO UTC and persisted as `snapshot_time` / `providerTimestamp`. | Actionability freshness, Product Freshness SLA, stale blocking. |
| Snapshot capture timestamp | The app-side observation or capture/write time from the acquisition job. | Audit, operations evidence, recency of app acquisition. |

Decision surfaces must not use snapshot capture time as actionable market freshness. Product Freshness SLA records this invariant as `provider_market_timestamp_not_page_generated_time`.

## Sportsbook Handling

The normalization path preserves sportsbook identity:

- `sportsbook`
- `provider_sportsbook_id`
- `provider_game_odd_id`
- `market`
- `outcome`
- `line`
- `price`
- `snapshot_time`

ODDS-01 found no repository evidence that Pick Analyzer collapses multiple sportsbook rows into consensus during normalization. The current production evidence instead shows that the visible current candidates are backed only by the returned/persisted sportsbook label `Consensus`.

## Current Production Evidence

Production commit:

`a9879543a94fc5817cfe1d1da82a16e7c2c2ca3a`

Latest public read-only evidence captured from production:

- `/api/system/version`: HTTP 200, provider calls made by read: 0.
- `/api/current-board?mode=current&limit=200`: HTTP 200.
- `/api/operations/event-refresh-plan?sportKey=baseball_mlb&operatingDate=2026-08-08&limit=200`: HTTP 200.
- `/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb`: HTTP 200.

Latest acquisition exposed by the public event-refresh plan:

| Field | Value |
| --- | --- |
| Started | `2026-08-08T23:27:28.555Z` |
| Completed | `2026-08-08T23:27:29.022Z` |
| Endpoint | `/api/mlb/odds/json/GameOddsByDate/2026-08-08` |
| Actual HTTP requests | 1 |
| Actual quota units | 1 |
| Provider records fetched | 15 |
| Pregame odds flattened | 2 |
| Normalized rows produced | 12 |
| Rows inserted | 12 |
| Rows updated | 0 |
| Latest source timestamp after acquisition | `2026-08-08T19:27:11.000Z` |
| Provider response observed at | `2026-08-08T23:27:28.881Z` |
| Source lag | approximately 240 minutes |

Visible current candidates:

| Count | Value |
| --- | --- |
| Candidates | 6 |
| Sportsbooks exposed | `Consensus` only |
| Newest source timestamp | `2026-08-08T19:17:15.000Z` |
| Oldest source timestamp | `2026-08-08T18:46:57.000Z` |
| Latest capture timestamp | `2026-08-08T23:17:34.766Z` |
| Median source lag | 240 minutes |
| Maximum source lag | 240 minutes |
| Product actionability | all stale candidates returned `WAIT_FOR_REFRESH` |

## Provider Documentation Summary

Official SportsDataIO documentation says MLB dates and times are in US Eastern Time. It documents betting market fields for `AvailableSportsbooks`, sportsbook-specific `BettingOutcomes`, and `ConsensusOutcomes`, plus betting outcome fields including sportsbook, price, value, created and updated timestamps.

SportsDataIO's MLB workflow guide documents game lines for spread, moneyline and totals, pre-match and in-play availability, timestamps for opening, line movement and closing, and advanced odds/props availability.

Official The Odds API documentation shows live/upcoming MLB odds with bookmaker-level `last_update`, core markets (`h2h`, `spreads`, `totals`), event-specific additional markets including first-five and player props, and a documented credit model where the `/odds` cost is markets multiplied by regions.

The Odds API public pricing material currently lists Professional at 20,000 requests/month for core markets and US sportsbooks, and Business at 200,000 requests/month with player props and historical archive access.

Sportradar odds documentation exposes player-prop bookmaker coverage and a change-log style feed, with documented change checks around 60 seconds for that product area.

Sources:

- SportsDataIO MLB Data Dictionary: https://sportsdata.io/developers/data-dictionary/mlb
- SportsDataIO MLB Workflow Guide: https://sportsdata.io/developers/workflow-guide/mlb
- The Odds API Docs: https://theoddsapi.com/docs/
- The Odds API MLB page: https://the-odds-api.com/sports/mlb-odds.html
- The Odds API FAQ/pricing: https://theoddsapi.com/faq.html
- Sportradar Player Props FAQ: https://developer.sportradar.com/odds/reference/oc-player-props-faq

## Polling Economics

Current SportsDataIO acquisition is date-level. One acquisition call can cover the active MLB slate for the operating date.

Adaptive cadence model:

| Window | Cadence | Calls per event-date window |
| --- | --- | --- |
| More than 6 hours before game | 60 minutes | 6 |
| 2-6 hours before game | 15 minutes | 16 |
| 30 minutes-2 hours before game | 10 minutes | 9 |
| Last 30 minutes before cutoff | 5 minutes | 6 |
| Total, 60-minute outer window |  | 37 |
| Total, 30-minute outer window |  | 43 |

Because the current acquisition is date-level, a 10-game slate and a 15-game slate do not multiply by event count under the current endpoint. They remain approximately 37-43 SportsDataIO HTTP requests per active operating date if every cadence slot runs, plus schedule/result calls. If this were changed to event-level acquisition, the same model would become approximately 370-430 calls for 10 games or 555-645 calls for 15 games.

Current production budget status at audit time:

- Daily SportsDataIO configured budget: 1000 HTTP requests.
- Protected reserve: 150.
- Used today: 117.
- Usable remaining: 733.
- Hourly remaining: 6.
- Evidence level: configured plus app ledger, not live provider quota headers.

Conclusion: the current budget can support date-level adaptive polling. Polling more often will not create fresh betting evidence when SportsDataIO returns unchanged source timestamps.

## Future Best-Price Architecture

Recommended future canonical structure:

Provider adapter -> bookmaker-specific snapshots -> canonical market normalization -> best-price selector -> consensus selector -> Current Board -> recommendation gates -> Official Picks

Future canonical market row requirements:

- Provider
- Bookmaker
- Event ID
- Market
- Selection
- Exact line
- American odds
- Provider/source timestamp
- App capture timestamp
- Source market identity
- Availability status
- Stale/actionability status

Future price policy:

| Surface | Recommended Price Source |
| --- | --- |
| Official Pick edge/EV | Certified book set with freshness gate; never stale. |
| Rent Play | Certified book set, safest/actionable price, never stale. |
| Best Value | Best available book when certified and fresh; otherwise consensus as informational only. |
| User workspace | User-selected book when configured; otherwise certified best book plus consensus comparison. |
| Model probability | Independent of sportsbook price. |

Consensus should remain useful as context, but it should not be the only production betting price when a user is deciding where to place a wager.

## Provider Architecture Options

### Option A: SportsDataIO As Sole Odds Provider

Advantages:

- Already integrated.
- Same provider supports MLB schedule, odds, result and operational budget flow.
- Current date-level request model is inexpensive.

Disadvantages:

- Current production evidence exposes only `Consensus` for visible candidates.
- Source timestamps can lag by about four hours even after successful provider calls.
- Exact current subscription tier is not provable from repository or public runtime evidence.
- Player props and sportsbook-group coverage may require different SportsDataIO products or entitlement confirmation.

### Option B: SportsDataIO Stats/Results Plus Specialized Odds Provider

Advantages:

- Keeps SportsDataIO for schedules/results/status where the app already has mature integration.
- Adds bookmaker-specific pricing for FanDuel, DraftKings, BetMGM, Caesars and other books.
- The Odds API has documented MLB core markets, bookmaker-level `last_update`, US regions, event-level props, historical archive and pricing.
- Allows best available price, consensus price and line movement to be product features without changing the model probability.

Disadvantages:

- Requires a new adapter, credential, budget pool and source-specific lineage.
- Requires mapping provider event IDs to canonical MLB events.
- Requires production certification that no stale source evidence becomes actionable.

### Option C: Alternative Consolidated Provider

Advantages:

- Sportradar-style feeds can offer broad sportsbook and props capabilities.
- Change-log approaches may support more targeted refresh.

Disadvantages:

- Higher integration and commercial complexity.
- Pricing and entitlement may require sales process.
- More disruptive than adding a dedicated odds adapter alongside existing SportsDataIO schedule/result integration.

Recommended architecture: Option B.

Recommended primary odds provider for current betting prices: The Odds API, subject to account approval and live certification.

Recommended stats/results provider: SportsDataIO remains primary.

## Root Cause Classification

Current stale odds issue classification:

- `PROVIDER_SOURCE_DELAY`: proven by one provider call at `2026-08-08T23:27:28Z` returning source evidence no newer than `2026-08-08T19:27:11Z`.
- `CONSENSUS_ROW_STALE`: proven by current candidates exposing only `Consensus` and stale provider/source timestamps.
- `PROVIDER_DATA_NOT_REAL_TIME`: supported for the current configured path by observed production source lag, but exact subscription-tier capability remains `UNKNOWN`.
- `PROVIDER_TIER_LIMITATION`: plausible but not proven; exact subscription tier is not exposed safely.
- `FRESHER_BOOK_ROWS_DISCARDED`: not proven.
- `NORMALIZATION_DEFECT`: not proven.
- `APPLICATION_POLLING_TOO_SLOW`: not the primary cause for the captured evidence because a recent call still returned source-stale rows.

## Pilot Safety

Production Pilot can continue under the current protections because stale provider/source evidence remains blocked:

- Official Pick gates must not use stale price evidence.
- Rent Play must remain `WAIT_FOR_REFRESH` when stale.
- Smart Parlay must exclude stale legs.
- Current Board can show stale prices only as non-actionable/informational evidence.

The next implementation phase should be an odds-provider selection and adapter design phase, not a cadence change.

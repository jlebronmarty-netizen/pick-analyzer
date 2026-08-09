# ODDS-02 The Odds API Shadow Integration

Status: `PASS_SHADOW_ONLY`

Observation time: `2026-08-09T00:07:30.084Z` UTC (`2026-08-08` operating evening in America/Puerto_Rico).

Starting production commit: `44764f928b6c5b20cf15a83453615ad06d55b66d`.

## Verdict

ODDS-02 successfully proved an isolated The Odds API shadow integration using `THE_ODDS_API_KEY` without touching `ODDS_API_KEY`, production odds authority, recommendations, predictions, settlement, learning or Performance.

The shadow provider returned fresher sportsbook-level evidence than the current SportsDataIO consensus source for exact matched events, but it remains shadow-only. More observation is required before any ODDS-03 cutover decision.

## Shadow Request

| Item | Result |
| --- | --- |
| Endpoint | `/v4/sports/baseball_mlb/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american` |
| HTTP status | 200 |
| Provider requests | 1 |
| Credits used | 3 |
| Credits remaining | 19997 |
| Events returned | 24 |
| Bookmakers observed | 11 |
| Market rows | h2h 190, spreads 194, totals 196 |
| Outcomes observed | 1160 |
| Latest The Odds API source timestamp | `2026-08-09T00:07:44Z` |

Bookmakers observed: BetMGM, BetOnline.ag, BetRivers, BetUS, Bovada, Caesars, DraftKings, FanDuel, Fanatics, LowVig.ag and MyBookie.ag.

## Exact Event Matching

Two production Current Board events matched exactly by normalized teams and start time:

| Production event | Provider event | Start delta | Books |
| --- | --- | ---: | ---: |
| `baseball_mlb:mlb:sportsdataio:event:79041` LAD @ ARI | `30fc735653380dfae5b9de10acf8b5f6` | 1 minute | 11 |
| `baseball_mlb:mlb:sportsdataio:event:79051` TB @ SEA | `79a0c1e324175df9d0c7f93de8d4dc44` | 0 minutes | 11 |

A later `LAD @ ARI` provider event for `2026-08-09T20:10:00Z` was deliberately excluded because it was the same teams but a different game time.

## Price Case Studies

| Candidate | Production price | Production source time | Production actionability | Best shadow price | Shadow book | Shadow source time | Model probability | Shadow edge | Shadow EV |
| --- | ---: | --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| LAD @ ARI moneyline ARI | +170 | `2026-08-08T20:07:22Z` | `WAIT_FOR_REFRESH` | +183 | Caesars | `2026-08-09T00:06:54Z` | 70.97% | +35.63 pp | +100.85% |
| LAD @ ARI spread LAD -1.5 | -117 | `2026-08-08T20:07:22Z` | `WAIT_FOR_REFRESH` | -114 | FanDuel | `2026-08-09T00:07:44Z` | 50.36% | -2.91 pp | -5.46% |
| TB @ SEA moneyline SEA | -121 | `2026-08-08T20:07:23Z` | `WAIT_FOR_REFRESH` | -115 | LowVig.ag | `2026-08-09T00:07:22Z` | 55.04% | +1.55 pp | +2.90% |
| TB @ SEA total Under 7 | -115 | `2026-08-08T20:07:23Z` | `WAIT_FOR_REFRESH` | -105 | Caesars | `2026-08-09T00:06:54Z` | 37.57% | -13.65 pp | -26.65% |

The production probability and confidence values were not changed. Shadow edge and EV are calculated with the existing market-alignment functions against the shadow price only.

## Safety Findings

- SportsDataIO remains production authority.
- The Odds API rows are not written to production odds tables.
- Production Current Board remains unchanged.
- Official Picks remain unchanged.
- Rent Play, Moneyline, Smart Parlay and Watchlist policies remain unchanged.
- Stale production source evidence remains non-actionable.
- Shadow evidence cannot be selected by production recommendation queries.
- No player props runtime implementation was added.
- No Historical Replay work was started.
- MC-03 was not started.

## Recommendation

Proceed with shadow observation only. Do not cut over to The Odds API until additional certified acquisitions prove stable event identity, source timestamps, book coverage, cost behavior and production-safety isolation over multiple slates.

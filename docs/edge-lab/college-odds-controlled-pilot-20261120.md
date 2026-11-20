# Controlled college odds pilot — 2026-11-20

## Authority and protection
User requested a strictly controlled test of already connected HoopsAPI and The Odds API to discover NCAA basketball/football market data. We used the configured provider credentials only on Vercel's private, authenticated Preview, never displayed the keys and did not start cron, change model weights, publish picks or write database rows.

The existing mainline The Odds API coverage audit uses `ODDS_API_KEY` first and stops at an intentionally high 2,000-credit reserve. A **separately configured** `THE_ODDS_API_KEY`, selected explicitly by the scoped Preview pilot, returned 20,000 remaining on the free-cost event endpoints. The two key values were not retrieved, compared or displayed. Do not merge the accounts or bypass mainline's reserve based on this result.

## Actual provider observations
- Existing server catalog probe (free `/sports`): 187 sports/competitions, 8 mapped enabled sports, and no odds requested.
- Preview manual `/sports/basketball_ncaab/events`: 76 live/upcoming provider events, 0 charged credits.
- Preview manual `/sports/americanfootball_ncaaf/events`: 80 events, 0 charged credits.
- Preview single `/sports/basketball_ncaab/odds?regions=us&markets=spreads,totals`: 75 events with Spread and Total; 1,198 bookmaker/market groups with >=2 numeric outcomes; 11 bookmaker identifiers, including FanDuel, DraftKings, Circa. 2 credits used.
- Preview single `/sports/americanfootball_ncaaf/odds?regions=us&markets=spreads,totals`: 80 events with Spread and Total; 1,502 groups with >=2 numeric outcomes; 12 bookmaker identifiers including FanDuel, DraftKings, Circa. 2 credits used.
- The reported quota moved 20,000 → 19,998 → 19,996. Total experimental cost **4 existing credits**. No new subscription, no paid historical endpoint, no automatically scheduled requests.
- `sports_odds_snapshots` still holds **zero** NCAAB and NCAAF rows after testing; no price ingestion into production. Group counts are NOT unique games or frozen bet opportunities.

## Verified partial identity matches
1. NCAAF **UCF Knights vs Iowa State Cyclones**: provider 2026-11-20 23:00Z, Pick `espn:401856869` with the same scheduled start and exact home/away names. Frozen on 2026-11-14, Pick margin home +5.083 and total 59.75. Provider FanDuel observed at 22:24:54Z (before event): UCF +1.5 (-112), Iowa State -1.5 (-108), O/U 49.5 (-115/-105). **Descriptive line distance**: +6.583 margin points relative to home spread / +10.25 total points; neither calibrated coverage probabilities nor EV or bet recommendations. Market-specific inclusion of overtime and jurisdiction are not independently certified.
2. NCAAB **Stephen F. Austin Lumberjacks vs Indiana State Sycamores**: provider team name abbreviation differs from Pick (`Indiana St` vs `Indiana State`). Pick `espn:401916123` at 20:00Z vs provider 20:10Z, 10-minute schedule discrepancy. Pick frozen 2026-11-19, home margin +1.637, total 146.96. Example provider spread quote was captured AFTER the scheduled start, so it **must not** be used as pregame quote evidence or a claimed edge.
3. NCAAB **Liberty Flames vs Rhode Island Rams**: matched participants; provider schedule 21:35:15Z vs Pick 21:30Z. The provider's sample quotes were also after start. Requires as-of validation before comparison.

## Blocking gates before any live recommendation
- Read-only identity crosswalk by provider event ID + both teams + kickoff timestamp tolerance + verified venue/home orientation; reject ambiguous or reversed matches.
- Exclude prices with provider market `last_update` after scheduled kickoff and preserve exact `captured_at`, provider original last update, raw market, line, price and source.
- Verify line arithmetic: home/away spreads are opposite, both sides of a total have the same line, every price is credible, bookmaker identifiers are authentic and the event is pregame.
- Compare frozen numeric margin/total using **properly estimated distributions**, not raw line-distance as a probability or ROI. Use prospective locked holds with settled records and time-separated calibration.
- Verify actual Puerto Rico FanDuel price availability, market contract and quota before showing Top recommendations.
- HoopsAPI NBA already uses a shared rolling 24-hour ledger and Preview-only durable capture; that account has concurrent ongoing use. We did not make an additional NCAA provider request under the NBA-only persistence scheme because it would pollute the NBA archive and potentially exceed provider-global quota. HoopsAPI NCAA data is publicly documented, not tested with live account-specific responses here.

## Code lifecycle
PR #387 is a private Preview-only manual experiment. Neither route changes production. The controlled priced route must stay disabled after the test and should not be merged unchanged as a reusable quota-consuming endpoint. A future production ingestion requires shared-account atomic budget ledger, immutable raw evidence storage, identity crosswalk and explicit activation approval.

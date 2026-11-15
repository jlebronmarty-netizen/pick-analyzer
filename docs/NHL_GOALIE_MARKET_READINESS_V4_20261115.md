# NHL Main Markets and Confirmed Goalie — V4 Readiness (15 November 2026)

## Production snapshot at research start
- NHL Poisson SHADOW has **five prospectively frozen rows**, with 0 settled/0 invalid in the audit at the time of this work. These were not back-filled or reprojected.
- One official NHL PP/PK team-summary capture was successful, verified for 32 teams on Nov 15 at 18:07 UTC, and research remains non-promoted.
- Existing 2026-27 NHL full-game general odds archive in sports_odds_snapshots last updated **July 28, 2026**, across ML, spread and totals; the currently refreshed free NHL quotes are Circa Moneyline. NO current puck line or total prices are certified in Pick Analyzer.
- THE_ODDS_API_KEY and ODDS_API_KEY are present in Vercel environment, but available credits/current daily budget are NOT verified. Existing odds acquisition source has a 2,000-credit reserve and an existing primary authority/staging framework. This proposal does not call The Odds API.
- sport_lineups currently has 0 NHL rows, so no database-side confirmed upcoming starting goalie is available.

## Data source reference
- The Odds API V4 supports the NHL featured markets h2h, spreads, totals (sport key icehockey_nhl), and some bookmakers including FanDuel. A single US-region call for three markets has an example charge of 3 credits, not necessarily guaranteed availability or credit balance. https://the-odds-api.com/sports/nhl-odds.html 
- Hockey goalie sources distinguish confirmed and expected. ESPN public scoreboard can expose probable goalies; independent outlet Daily Faceoff reports confirmation and source references. Neither source is yet connected to our authenticated model feature ledger. https://www.dailyfaceoff.com/starting-goalies and https://sportsdata.io/developers/workflow-guide/nhl

## New V4 research-only components
1. Pure exact contract normalizer for a **two-sided** and time-valid bookmaker pair of current NHL Moneyline, puck line or total, with exact event name, paired handicap/total, American prices, and quote/capture timestamps. Emits provisional fair probabilities, but never sportsbook settlement or betting recommendation.
2. Separate pure source gate for goalie probable vs confirmed, requiring an explicit named source, published timestamp, team and goalie ID, explicit statement of intent to start, and a verified stable goalie ID. Historical starters alone never count as today's confirmed.
3. New no-call GET /api/nhl/market-goalie-readiness surfaces stale NHL market coverage, source prerequisites, no confirmed goalie source, and status of budget verification. It reads existing Supabase snapshots only.
4. Unit tests cover changing home/away/line, stale prices, post-decision goalie reports, implied probabilities, and fail-closed no provider calls.
5. No data migration, no new cron schedule, no new secret, no paid subscription, no writes, no official-pick modifications, no Poisson model formula adjustment.

## Next gate
- Check The Odds API quota and configured region/provider budget BEFORE adding opt-in NHL quote acquisition. Never turn on recurring calls without explicit limit and measured credits. Keep the market rule and jurisdiction uncertified until separately verified.
- Validate a genuinely timestamped, documented pregame goalie feed, with evidence demonstrating that a specific team/goalie was confirmed before cutoff. Probable alone is not enough. No inferred starting goalies from previous-game boxscores.
- Accumulate prospective, settled NHL SHADOW predictions and compare Challenger versus DRatings and market no-vig on the same games. NHL V4 does not claim accuracy or return advantage.


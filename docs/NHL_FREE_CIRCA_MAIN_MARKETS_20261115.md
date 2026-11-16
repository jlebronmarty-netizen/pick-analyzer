# NHL — Free Circa Puck Line + Total Research Capture (15 November 2026)

## Actual stored-source proof
- Inspected FIVE already archived DRatings game-detail HTML payloads at 2026-11-16 00:07 UTC in a preview-only endpoint. This involved zero additional provider HTTP calls.
- These payloads contain scroll-money, scroll-spread and scroll-ou sections.
- scroll-spread has a verified two-row Circa book column for away/home with exact +1½/-1½ handicaps and American prices.
- scroll-ou has a verified two-row Circa column for Over and Under, including exact lines of 6 and 6½ and paired American prices. Never assume all games have an O/U 5.5 quote.
- This material is a free public source already fetched by the existing NHL core cron. It is NOT FanDuel, and exact provider updated-at times and sportsbook OT/SO settlement rules are unverified.
- Public reference: https://www.dratings.com/predictor/nhl-hockey-predictions/

## Integrated collector
- The same original NHL source fetch for game detail is reused. No extra calls, credentials, subscriptions, new schedule or extra table.
- A pure parser accepts only an exact Circa two-row table. It refuses mismatched team names, missing or mixed handicap sides, unmatched Over/Under points, invalid American prices and partial bookmaker columns.
- Research-only marketQuoteObservations are stored in the existing half-hour nhl_free_runs_v1.detail JSON. Each record includes exact event ID, team IDs, fixture start, captured timestamp, raw source ID and exact line+price. An observation must be collected at least 10 minutes before puck drop.
- The existing DRatings Moneyline prediction, Circa ML quote and outcome collectors remain unchanged. Parsed research spread/total does NOT influence any model weights, Official Picks, automatic wagers or forecast credibility.
- GET /api/nhl/free-main-market-coverage is a read-only 21-day, 2000-row-cap paginated audit of prospective quotes by market, unique games and capture time. It does not certify an edge or prove that the book is accessible in Puerto Rico.

## Calibration and comparison
Five already frozen challenger predictions stay immutable. Free Circa prices captured at a DIFFERENT time from those forecasts cannot substantiate same-time EV or CLV. Analyze as separate prospective snapshots only.

Before recommending plays, freeze a matched same-time window of model probabilities and exact quotes, confirm full-game NHL OT/SO settlement semantics (including push rules) and evaluate directional accuracy, Brier/log loss, total/margin MAE and correctly priced subset ROI on a chronological holdout. Six earlier chronological challenger evaluations cannot demonstrate superiority.

## Sports subscription policy
Only NBA uses GOAT. All other sports, including NHL, must use free official/public sources and archived evidence. This collector makes zero additional provider calls and invokes no paid odds API.

# Market Intelligence Engine V1

Status: Completed as read-only orchestration.

Market Intelligence Engine scans the current stored market universe and decides which markets deserve attention. It is not a prediction engine and does not calculate new game probabilities. Current Board is the only source of actionable candidate rows.

## Sources

- Current Board: source of truth for current, future, unstarted, latest-safe stored candidates.
- Most Likely: ranking compatibility check.
- Best Value: value-ranking compatibility check.
- AI Bet Finder: readiness contract through Current Board.
- Arbitrage: independent stored-odds status check.

The service makes zero provider calls and performs zero remote mutations.

## Scanner

The scanner returns one market list with available and unavailable entries. Current supported MLB markets are:

- Moneyline
- Run Line
- Total

Unavailable markets remain visible but blocked or unsupported:

- Team Totals
- First Half
- First Five
- Player Props
- Pitcher Props
- Specials
- Futures

Future sport extension slots are included for NBA, NFL, NHL, Soccer, Tennis and BSN without requiring a rewrite.

## Classification

Each row receives:

- availability
- quality
- coverage
- confidence
- recommendation
- reason
- explanation

Recommendation categories:

- `Elite`
- `Strong Value`
- `Watch`
- `Pass`
- `Unavailable`

Market health categories:

- `Healthy`
- `Limited`
- `Missing Data`
- `Blocked`
- `Unsupported`

## Score

The Market Intelligence Score is display-only and uses already-computed Current Board values:

- probability
- edge
- EV
- confidence
- reliability
- AI rating
- market stability
- feature quality
- data sufficiency
- recommendation policy status

The score never changes stored prediction rows and never promotes an official pick.

## API

Single route:

- `GET /api/market-intelligence`

Supported query options:

- `sort=best_combined|highest_probability|highest_ev|highest_confidence|highest_ai_rating|lowest_risk`
- `includeUnavailable=true|false`
- `limit=1..100`
- `sport`
- `game`
- `market`
- `sportsbook`
- `risk=low|medium|high`
- `recommendation=Elite|Strong Value|Watch|Pass|Unavailable`
- `minAiRating`
- `minConfidence`
- `minEdge`
- `minEv`
- `minOdds`
- `maxOdds`
- `validate=true`

## Current Validation

Current response:

- markets scanned: 16
- available/supported: 3
- passes: 3
- unavailable: 13
- elite: 0
- strong value: 0
- watch: 0
- provider calls: 0
- remote mutations: 0
- validation fixtures: 18/18

The current `NYM @ PHI` slate remains analyzed-only, no-value at the stored price, and not official.

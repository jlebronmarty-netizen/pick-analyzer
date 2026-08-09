# The Odds API Shadow Provider V1

Status: `SHADOW_ONLY`

ODDS-02 adds an isolated The Odds API comparison path for MLB core markets. It is not a production odds authority and it does not feed Current Board, Rent Play, Moneyline Bet, Smart Parlay, Watchlist, Official Picks, settlement, learning or Performance.

## Credential Boundary

- Shadow credential: `THE_ODDS_API_KEY`.
- Legacy variable: `ODDS_API_KEY`.
- ODDS-02 does not read `ODDS_API_KEY` and does not fall back to it.
- Secret values are never written to logs, docs, responses or certification artifacts.

## Runtime Boundary

- Route: `/api/operations/odds-shadow-comparison`.
- `GET` is dry-run and performs zero provider calls.
- `GET ?validate=true` validates credential isolation only.
- `POST` live execution requires the existing protected scheduler secret boundary, `live=true`, `confirm=ODDS_02_SHADOW` and `maxCalls` between 1 and 3.
- Live shadow output is in-memory response/certification evidence only.
- No production odds tables are written by ODDS-02.

## Request Shape

ODDS-02 uses one MLB league-wide request:

`/sports/baseball_mlb/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american`

Normalization:

| Provider market | Product market |
| --- | --- |
| `h2h` | `moneyline` |
| `spreads` | `spread` |
| `totals` | `total` |

Identity matching requires:

- same normalized home team;
- same normalized away team;
- provider commence time within 15 minutes of the production event start;
- exact market;
- exact selection;
- exact line when a line exists.

Ambiguous or unmatched events remain shadow evidence only and are excluded from price comparisons.

## Timestamp Contract

ODDS-02 preserves two timestamps:

| Field | Meaning | Actionability use |
| --- | --- | --- |
| `sourceTimestamp` | sportsbook/bookmaker market update time from The Odds API market or bookmaker payload | Eligible for freshness classification |
| `captureTimestamp` | Pick Analyzer shadow acquisition time | Evidence capture only |

Capture time must not be used to make stale market evidence actionable. This matches the Product Freshness SLA principle that betting actionability depends on underlying market evidence, not API response time.

## Production Authority

SportsDataIO remains the production odds authority during ODDS-02. The Odds API is used only to measure:

- sportsbook diversity;
- exact market identity coverage;
- source timestamp freshness;
- price availability by book;
- possible edge/EV differences using existing market-alignment functions.

ODDS-02 does not change:

- prediction probability;
- confidence;
- edge/EV formulas;
- Official Pick policy;
- Rent Play, Moneyline, Smart Parlay or Watchlist policy;
- settlement or learning;
- provider budgets or scheduler cadence.

## Certification Acquisition

The first certified shadow acquisition used 1 HTTP request and 3 credits. It returned 24 MLB events, 11 sportsbooks, 190 h2h market rows, 194 spread market rows and 196 total market rows. Two production Current Board events matched exactly by team and start time: `LAD @ ARI` and `TB @ SEA`.

Cutover decision: `MORE_SHADOW_EVIDENCE_REQUIRED`.

# NBA BallDontLie Provider V1

Status: `PREP_READY_NO_PROVIDER_CALLS`

BallDontLie is the candidate NBA non-odds provider for the next NBA historical foundation step. NBA odds remain owned by The Odds API. SportsDataIO NBA remains legacy/trial only and is not expanded.

## Configuration

| Variable | Scope | Required Now | Required At START | Notes |
| --- | --- | --- | --- | --- |
| `BALLDONTLIE_API_KEY` | local `.env.local` | no | yes | Do not add to Vercel for local historical import unless a future runtime phase requires it. |

The key must never be written to docs, fixtures, certification JSON, logs or committed files.

## HTTP Contract

| Item | Contract |
| --- | --- |
| Base URL | `https://api.balldontlie.io` |
| Auth | `Authorization` header |
| Timeout | 25 seconds |
| PREP behavior | calls disabled |
| START behavior | requires explicit future authorization |
| Trial hard limit | 5 requests/minute |
| Configured safe limit | 4 requests/minute |
| Pagination | cursor with `next_cursor` |
| Page size | max `per_page=100` where supported |

## Endpoint Priorities

| Priority | Endpoints | Reason |
| --- | --- | --- |
| P0 | Teams, Players, Games, Game Player Stats, Box Scores, Game Advanced Stats V2 | Identity, schedule/results, player-game stats and high-value GOAT historical context. |
| P1 | Lineups, Team Season Averages, Season Averages, Standings | Useful after P0, but averages/standings are validation-only unless as-of semantics are proven. |
| P2 | Active Players, Injuries, Plays | Forward/research value; do not let these consume P0 trial time. |
| P3 | Leaders, Contracts, BallDontLie odds, Player Props | Deferred; not needed for NBA-02 core replay. |

## Replay Safety

Final season averages, final standings and retrospective leaderboards are not pregame-safe for earlier historical games. They can be imported for validation or research, but NBA-02 replay features must be built chronologically from completed prior-game evidence.

## Implementation

The prep adapter lives in `src/services/balldontlie-nba-goat-prep.service.ts` and provides:

- static endpoint/tier matrix;
- START-gated HTTP client;
- global 4 request/minute rate limiter;
- raw payload persistence before DB normalization;
- request manifest generation;
- fixture-safe normalizers for teams, players, games, results, quarter scores and player stats;
- shape-preserving normalizers for GOAT boxscore, advanced-stat and lineup payloads.

No provider call is made by the prep validator.

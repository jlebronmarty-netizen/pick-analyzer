# SportsDataIO MLB Catalog

Status: Cataloged, provider-independent implementation pending.

First safe pilot preference:

- Teams, then one completed date of games/results.
- Maximum 2 calls, concurrency 1, no retries.

Important MLB-specific domains to preserve before production use:

- probable and starting pitcher context
- bullpen context
- park and weather context
- batter handedness and hitter-vs-pitcher context
- first-five-innings market compatibility

Exact catalog entries live in `src/config/sportsdataio-endpoint-catalog.ts`.

Shared SportsDataIO betting normalization is available for future MLB odds fixtures, but live MLB odds calls remain blocked until MLB-specific event/game identifiers, sportsbook coverage and persistence checks pass locally.

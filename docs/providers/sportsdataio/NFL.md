# SportsDataIO NFL Catalog

Status: Cataloged, provider-independent implementation pending.

First safe pilot preference:

- Teams, then one completed week/date of results.
- Maximum 2 calls, concurrency 1, no retries.

Important NFL-specific domains to preserve before production use:

- season/week identity
- quarterback context
- injury and depth-chart context
- rest and bye-week context
- weather and red-zone stats
- first-half/quarter market compatibility

Exact catalog entries live in `src/config/sportsdataio-endpoint-catalog.ts`.

Shared SportsDataIO betting normalization is available for future NFL odds fixtures, but live NFL odds calls remain blocked until season/week, score/game identifiers, sportsbook coverage and persistence checks pass locally.

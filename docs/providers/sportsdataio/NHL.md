# SportsDataIO NHL Catalog

Status: Cataloged, provider-independent implementation pending.

First safe pilot preference:

- Teams, then one completed date of games/results.
- Maximum 2 calls, concurrency 1, no retries.

Important NHL-specific domains to preserve before production use:

- starting goaltender context
- goalie depth and form
- line combinations
- regulation versus overtime market semantics
- first-period and goalie/player prop compatibility

Exact catalog entries live in `src/config/sportsdataio-endpoint-catalog.ts`.

Shared SportsDataIO betting normalization is available for future NHL odds fixtures, but live NHL odds calls remain blocked until game identifiers, goalie/period context, sportsbook coverage and persistence checks pass locally.

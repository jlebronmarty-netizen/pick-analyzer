# SportsDataIO Soccer Catalog

Status: Cataloged, provider-independent implementation pending.

First safe pilot preference:

- One competition only.
- Competition metadata, then one completed date.
- Maximum 2 calls, concurrency 1, no retries.

Soccer integration must preserve:

- competition ID/key
- season and round
- home/draw/away outcome structure
- team identity scoped to competition
- competition-specific event mapping

Do not query every competition or treat all soccer competitions as one league.

Exact catalog entries live in `src/config/sportsdataio-endpoint-catalog.ts`.

Shared SportsDataIO betting normalization is available for future Soccer odds fixtures, but live Soccer odds calls remain blocked until one competition is selected and competition-scoped identifiers, three-way outcomes, sportsbook coverage and persistence checks pass locally.

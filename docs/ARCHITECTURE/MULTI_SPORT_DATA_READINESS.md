# Multi-Sport Data Readiness

Status: MC-02 production-certified.

The multi-sport data-readiness contract answers whether each configured target sport has enough canonical data to advance later through prediction, persistence, result, settlement, learning, performance and certification.

## Runtime Contract

Read-only API:

- `/api/mission-control/data-readiness`

Normal reads:

- call no providers;
- mutate no remote data;
- generate no predictions;
- settle no rows;
- create no learning labels;
- preserve scheduler cadence.

## Canonical Domains

Each sport is classified across:

- schedule/events;
- teams/participants;
- players/fighters;
- provider mappings;
- odds;
- authoritative results;
- standings and game stats;
- injuries and lineups where relevant;
- feature inputs;
- historical/current coverage.

## Provider Coverage

SportsDataIO is the isolated active provider pool for certified MLB current operating-day acquisition through the protected scheduler. NBA SportsDataIO evidence exists but remains gated.

The Odds API is a separate credit pool. Prior bounded evidence exists for odds and scores, but normal MC-02 reads do not refresh quota headers, reset semantics or live coverage. It remains shadow-only until a future approved provider mission.

BSN is source-specific. It must not be treated as The Odds API-covered. Official/manual/CSV or future provider sources require provenance before production use.

## Readiness States

- `DATA_READY`: canonical data is sufficient for later mission gates.
- `DATA_PARTIAL`: useful stored data exists, but at least one critical domain is incomplete.
- `DATA_FOUNDATION`: architecture or deterministic compatibility exists without enough real production data.
- `PROVIDER_BLOCKED`: provider/source provenance blocks readiness.
- `SUBSCRIPTION_BLOCKED`: known subscription entitlement blocks readiness.
- `MAPPING_BLOCKED`: canonical crosswalk gaps block readiness.
- `HISTORICAL_ONLY`: only historical data is available.
- `NOT_CONFIGURED`: sport is not configured.
- `UNKNOWN`: evidence is missing or unreadable.

MC-02 does not require every sport to be `DATA_READY`; it requires every target sport to be classified honestly with blockers and next actions.

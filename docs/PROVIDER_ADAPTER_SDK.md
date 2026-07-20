# Provider Adapter SDK

Status: Active

The Provider Adapter SDK defines normalized provider contracts for schedules, scores, standings, teams, players, injuries, lineups, odds and stats.

SportsDataIO Discovery V1 reuses:

- `sportsdataio-adapter-contract.service.ts`
- `sportsdataio-runtime-adapter.service.ts`
- `sportsdataio-endpoint-catalog.ts`
- Existing normalized tables and sync job metadata

Discovery does not create a parallel provider SDK and does not enable live calls by itself.

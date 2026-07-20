# Live Provider Verification

Status: Implemented
Version: V1

## API

- `GET /api/providers/live-verification`
- `POST /api/providers/live-verification`

`GET` is dry-run only and makes zero provider calls.

`POST` defaults to dry-run. `dryRun=false` requires `CRON_SECRET` authorization.

## Budgets

Hard caps enforced by the route:

- SportsDataIO: max 30 calls
- The Odds API: max 10 calls
- MLB Stats API: max 15 calls

The default live plan is intentionally lower:

- SportsDataIO: 9 calls
- The Odds API: 2 calls
- MLB Stats API: 3 calls
- Official BSN homepage connector: existing connector internal limit

## Providers Tested

- SportsDataIO MLB Discovery Lab, when `SPORTSDATAIO_MLB_API_KEY` exists.
- The Odds API, when `ODDS_API_KEY` exists.
- MLB Stats API public endpoints.
- Official BSN homepage connector.

## Data Captured

The verifier records sanitized runtime evidence:

- Endpoint status
- HTTP status
- Row count
- Byte count
- Field population
- Empty fields
- Identity fields
- Usable fields
- Display/projection/prediction quality labels
- Canonical provider ownership recommendation

Raw payloads and secrets are not returned.

## Persistence

Live execution writes one checkpoint row to `sports_sync_jobs` with sanitized endpoint metadata and call counts.

The verifier does not bypass existing importers. Durable SportsDataIO entity mapping and game-stat acquisition remain delegated to the existing historical import executor.

## Forbidden Mutations

The verifier does not mutate:

- Prediction formulas
- Prediction history
- Official pick thresholds
- Champion/challenger/V7 status
- Current Board policy
- Settlement
- Learning
- Projection history

## Projection Policy

After live verification, projection counts are rechecked in dry-run mode. No projection is activated unless the existing Projection Integrity requirements are already satisfied.

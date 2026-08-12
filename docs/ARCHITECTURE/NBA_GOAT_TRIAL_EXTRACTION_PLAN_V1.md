# NBA GOAT Trial Extraction Plan V1

Status: `BALLDONTLIE_GOAT_TRIAL_EXTRACTION_READY`

The BallDontLie GOAT trial must be used as a scarce 48-hour historical bootstrap window. The trial must not start until the adapter, manifest, raw payload durability and validation are already certified.

## Trial Capacity

| Metric | Value |
| --- | ---: |
| Hard provider limit | 5 requests/minute |
| Safe operating rate | 4 requests/minute |
| Trial duration | 48 hours |
| Reserve | 4 hours |
| Theoretical requests | 14,400 |
| Planned safe requests | 2,477 |
| Estimated queue time | 10.32 hours |
| Capacity classification | `FITS_COMFORTABLY_IN_48H` |

## Import Order

| Phase | Work |
| --- | --- |
| 0 | Confirm key presence, account/tier, raw storage, DB access and no-mutation fixture checks. |
| 1 | 2024-25 teams, players and games. |
| 2 | 2024-25 game player stats and box scores. |
| 3 | 2024-25 advanced stats and lineups if schema is useful. |
| 4 | Repeat P0 for 2023-24 and 2022-23. |
| 5 | P1 validation-only standings and season averages. |
| 6 | Gap fill, coverage certification and downgrade recommendation. |

## Request Safety

Each successful response must be written under ignored local storage before normalization or DB persistence:

`data/imports/balldontlie/nba/<season>/<endpoint>/<request-id>.json`

A database failure must retry from durable raw payload, not from the provider. A process restart resumes from the manifest cursor/page. A 429 response pauses the global queue using `Retry-After`; no parallel worker may bypass the provider-wide limit.

## START Boundary

Human sequence after PREP:

1. Activate BallDontLie NBA GOAT 48-hour trial.
2. Obtain API key.
3. Store key as `BALLDONTLIE_API_KEY` in local `.env.local`.
4. Tell Codex `START`.
5. Run Phase 0.
6. Continue queue only after Phase 0 returns GO.

No billing, provider call, NBA production activation, SportsDataIO expansion, bulk replay or player-prop phase is authorized by this PREP certification.

# The Odds API Player Props V1

Generated: 2026-07-28T02:59:13.442Z

Commit: `7fa4514e6cb6e57c33a501382c075cdc4a018c04`

Status: LIVE_PLAYER_PROP_DISCOVERY_COMPLETE

## Credit Safety

- Provider calls made: 40
- Requests remaining before: 19923
- Requests remaining after: 19923
- Requests used observed: 0
- Required reserve: 2000

## Persistence

- Rows accepted: 0
- Rows rejected: 0
- Rows inserted: 0
- Rows updated: 0
- Duplicate deterministic IDs: 0
- Production mutations recorded: 1

## Sport Coverage

| Sport | Events tested | Markets tested | Markets with rows | Rows accepted | Rows rejected |
| --- | ---: | ---: | --- | ---: | ---: |
| MLB Baseball | 2 | 24 | none | 0 | 0 |
| NFL Football | 2 | 14 | none | 0 | 0 |

## Safety Notes

- Market support is based on actual event-level provider responses; unsupported and empty markets are not fabricated.
- Player identity is stored as provider text only unless a canonical identity is already proven elsewhere.
- No prediction generation, feature rebuild, SQL migration, scheduler change, settlement write or recommendation-policy change was executed.

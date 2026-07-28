# The Odds API Scores Results V1

Generated: 2026-07-28T03:09:55.099Z

Commit: `c5be0e33ad438cd6b89c34df11eb0261b729c8a0`

Status: LIVE_SCORES_RESULTS_SYNC_COMPLETE

## Credit Safety

- Provider calls made: 4
- Requests remaining before: 19523
- Requests remaining after: 19521
- Requests used observed: 2
- Required reserve: 2000

## Result Coverage

| Sport | HTTP | Events returned | Completed rows | Inserted | Updated | Reused | Message |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| NFL Football | 422 | 0 | 0 | 0 | 0 | 0 | no completed score rows returned |
| NHL Hockey | 200 | 32 | 0 | 0 | 0 | 0 | no completed score rows returned |
| NBA Basketball | 200 | 0 | 0 | 0 | 0 | 0 | no completed score rows returned |
| UFC | 422 | 0 | 0 | 0 | 0 | 0 | no completed score rows returned |

## Safety Notes

- MLB is excluded because MLB Stats remains the stronger canonical result source.
- The Odds API scores are stored only as exact completed score rows for non-MLB sports.
- No box scores, player stats, injuries, lineup data, prediction generation or settlement execution was inferred.

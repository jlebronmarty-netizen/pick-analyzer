# Multi-Sport Results Crosswalk Foundation V1

Generated: 2026-07-28T03:34:01.101Z

Commit: `c0af0c7578b0f6f9bd190e3d5c834650cc0bb318`

Status: MULTI_SPORT_RESULTS_CROSSWALK_FOUNDATION_COMPLETE

## Execution

- Provider calls made: 5
- Production mutations made: 13
- Requests remaining before: 19521
- Requests remaining after: 19515
- Required reserve: 2000
- Persist mode: true

## Sport Evidence

| Sport | Provider key | Score HTTP | Score events | Completed rows | Inserted | Updated | Stored odds | Canonical events | Stored results | Lifecycle state |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| NBA | basketball_nba | 200 | 0 | 0 | 0 | 0 | 0 | 14 | 0 | BLOCKED_NO_STORED_ODDS_FOUNDATION |
| NFL | americanfootball_nfl | 200 | 75 | 0 | 0 | 0 | 1978 | 0 | 0 | FOUNDATION_BLOCKED_BY_RESULT_OR_CANONICAL_CROSSWALK |
| NHL | icehockey_nhl | 200 | 32 | 0 | 0 | 0 | 426 | 0 | 0 | FOUNDATION_BLOCKED_BY_RESULT_OR_CANONICAL_CROSSWALK |
| Soccer aggregate | soccer | 404 | 0 | 0 | 0 | 0 | 260 | 0 | 0 | FOUNDATION_BLOCKED_BY_RESULT_OR_CANONICAL_CROSSWALK |
| UFC/MMA | mma_mixed_martial_arts | 200 | 44 | 12 | 12 | 0 | 360 | 0 | 12 | FOUNDATION_BLOCKED_BY_RESULT_OR_CANONICAL_CROSSWALK |

## Safety Notes

- Provider-native event mappings are not treated as certified canonical crosswalks.
- Completed score rows are persisted only when The Odds API marks an event completed and supplies numeric home/away scores.
- No predictions, recommendations, model weights, thresholds, epochs, feature rebuilds or learning weights are changed.
- Sports without exact canonical event/result chains remain blocked from Preview prediction activation.

# NBA-01C Recover BallDontLie GOAT Extraction

Status: `BALLDONTLIE_GOAT_HISTORICAL_EXTRACTION_RECOVERY_PASS`

The interrupted NBA-01C extraction resumed from the durable manifest after PC/network restart. Completed provider pages were not refetched, raw payloads stayed ignored, and the failed advanced-stat DB page was recovered from raw evidence with zero additional provider calls.

## Recovery Summary

| Item | Result |
| --- | --- |
| PC restart recovery | `PC_RESTART_RECOVERY_PASS` |
| Manifest recovered | yes |
| Raw payloads preserved | yes |
| Failed DB task recovered from raw | yes |
| Completed provider pages refetched | 0 |
| Final manifest tasks | 5,116 |
| DB persisted tasks | 5,116 |
| Failed tasks | 0 |
| Provider calls total | 5,116 |
| SportsDataIO calls | 0 |
| NBA Current Era writes | 0 |

## Final Extraction Counts

| Endpoint | Tasks | Rows |
| --- | ---: | ---: |
| teams | 1 | 45 |
| players | 57 | 5,612 |
| games | 39 | 3,710 |
| stats | 1,286 | 128,353 |
| advanced_stats_v2 | 3,583 | 358,195 |
| box_scores | 150 | 0 |

## Recovery Repairs

- Added bounded transient Supabase retry for temporary transport failures.
- Preserved raw-before-DB persistence and manifest checkpointing.
- Avoided repeated team/player identity rewrites from advanced-stat pages.
- Resolved advanced-stat event, team and player identities from bounded DB-backed maps before writing stat rows.
- Repaired 100 previously imported advanced-stat rows by binding them to existing canonical events.

## Subscription Recommendation

Recommended tier: `DOWNGRADE_TO_ALL_STAR_RECOMMENDED`.

GOAT supplied high-value historical advanced stats for bootstrap. Forward daily NBA runtime is expected to need games, status/results, players, player-game stats and availability first; GOAT-only live domains should stay unpurchased unless NBA-02 or a later production runtime phase proves they are required.

NBA-02 is the next phase. It must reconstruct features chronologically and run replay; NBA-01C did not start replay.

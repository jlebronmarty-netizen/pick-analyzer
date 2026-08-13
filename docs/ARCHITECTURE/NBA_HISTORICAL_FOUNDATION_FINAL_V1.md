# NBA Historical Foundation Final V1

Status: `NBA_HISTORICAL_FOUNDATION_CERTIFIED_READY_FOR_REPLAY`

NBA-01C recovered the interrupted BallDontLie GOAT extraction from durable local state and completed the historical sports-data foundation for NBA replay preparation. NBA production remains inactive.

## Owned Historical Foundation

| Domain | Coverage |
| --- | ---: |
| Seasons | 2022-23, 2023-24, 2024-25 |
| Canonical BallDontLie games | 3,710 |
| Canonical BallDontLie results | 3,710 |
| BallDontLie player identities | 5,612 |
| Normal player-game stat rows | 128,353 |
| Advanced stat rows | 358,195 |
| Team-game stat rows | 7,420 |
| Box score endpoint rows | 0 |
| Unbound advanced-stat rows after recovery | 0 |

## Season Coverage

| Season | Games | Normal Stats | Advanced Stats | Team Game Stats |
| --- | ---: | ---: | ---: | ---: |
| 2022-23 | 1,236 | 41,129 | 118,690 | 2,472 |
| 2023-24 | 1,237 | 43,615 | 118,443 | 2,474 |
| 2024-25 | 1,237 | 43,609 | 121,062 | 2,474 |

Games supply final scores and period-score fields where BallDontLie provides them. Box score batch requests returned zero rows and are classified as a provider/request-shape gap, not as evidence of missing core player stats because the normal stats and advanced stats streams completed.

## Provider Lineage

| Provider | Role |
| --- | --- |
| The Odds API | NBA odds / market authority candidate. Existing 2024-25 historical price foundation is preserved. |
| BallDontLie GOAT | Historical NBA sports-data bootstrap for games, results, players, player-game stats and advanced stats. |
| BallDontLie ALL-STAR | Expected forward non-odds candidate if daily NBA runtime later certifies it. |
| SportsDataIO NBA | Legacy/trial only; not expanded. |
| NBA Stats public endpoints | Not reliable from this execution environment. |

## Replay Boundary

NBA-02 may reconstruct chronological features and replay historical predictions from this foundation. NBA-01C did not activate NBA production, create Current Era NBA predictions, run bulk replay, promote calibration, call SportsDataIO, or change MLB.

Advanced stats are owned historical evidence, but they remain shadow feature candidates until NBA-02 proves chronological safety and model value.

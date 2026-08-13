# NBA Final Provider Map V1

Status: `NBA_PROVIDER_MAP_NBA_01A_BOOTSTRAP_PENDING_ACCESS`

Certification commit: `bf89777ad5f97f8e7fb40ac1835b29424182ca20`

NBA-01 defines the target NBA provider architecture without activating NBA production runtime.

## Provider Role Matrix

| Domain | Target Source | Cost | Authority Role | Certification Status |
| --- | --- | --- | --- | --- |
| Odds | The Odds API, `basketball_nba` | Paid/credit budget | Future NBA product odds authority | `EXISTING_INTEGRATION_NOT_ACTIVATED` |
| Schedule | Official/free NBA source candidate | Free/public access candidate | Future non-odds authority | `NEEDS_EXTERNAL_ACCESS_REVIEW` |
| Status | Official/free NBA source candidate | Free/public access candidate | Future non-odds authority | `NEEDS_EXTERNAL_ACCESS_REVIEW` |
| Results | Official/free NBA source candidate | Free/public access candidate | Future result authority | `NEEDS_EXTERNAL_ACCESS_REVIEW` |
| Teams | Existing canonical `sports_teams` plus official crosswalk | Free/stored | Canonical dimension | `PARTIAL_CERTIFIED` |
| Players | Existing `sport_players` plus official crosswalk | Free/stored | Canonical dimension | `PARTIAL_CERTIFIED` |
| Team stats | Official/free NBA boxscore/stat source candidate | Free/public access candidate | Future historical/current source | `NEEDS_EXTERNAL_ACCESS_REVIEW` |
| Player stats | Official/free NBA boxscore/stat source candidate | Free/public access candidate | Future historical/current source | `NEEDS_EXTERNAL_ACCESS_REVIEW` |
| Boxscores | Official/free NBA source candidate | Free/public access candidate | Future boxscore source | `NEEDS_EXTERNAL_ACCESS_REVIEW` |
| Quarter scores | Official/free NBA source candidate | Free/public access candidate | Future period-score source | `NEEDS_EXTERNAL_ACCESS_REVIEW` |
| Lineups | Existing stored/trial rows; future official or approved source | Unknown/free preferred | Soft context only | `PARTIAL_NOT_CORE_REQUIRED` |
| Injuries | Existing stored/trial rows; future approved source | Unknown/free preferred | Soft context only | `PARTIAL_NOT_CORE_REQUIRED` |
| Historical | Official/free source candidate plus owned stored data | Free/public access candidate | Future historical foundation | `PARTIAL_MORE_IMPORT_REQUIRED` |
| Fallback | SportsDataIO only where already stored or explicitly authorized | Paid | Legacy/reference only | `LEGACY_NOT_NORMAL_RUNTIME` |

## Provider Decisions

- The Odds API remains the preferred NBA odds source, but NBA odds acquisition is not activated by NBA-01.
- SportsDataIO NBA is not required for the target normal runtime and is not expanded.
- Existing SportsDataIO NBA rows are retained as trial/legacy evidence and rollback/context evidence, not as production authority.
- Official/free NBA source candidates require access and terms review before bulk import. NBA-01 does not certify a bulk importer against a public endpoint.

## Paid Provider Dependency

| Provider | NBA Role | Runtime Dependency | Exit Requirement |
| --- | --- | --- | --- |
| SportsDataIO | Legacy/trial stored NBA evidence | `NO_NORMAL_RUNTIME_DEPENDENCY` | Preserve existing rows; do not expand |
| The Odds API | Future NBA odds authority | `FUTURE_ODDS_DEPENDENCY` | Explicit credit budget before live calls |

NBA normal non-odds runtime target is official/free. NBA odds runtime target is The Odds API under existing product strategy.

## NBA-01A Domain Authority Update

NBA-01A refines the map without activating runtime:

| Domain | Authority | Bootstrap Status |
| --- | --- | --- |
| Core odds | The Odds API | approved target; production NBA inactive |
| Historical core prices | The Odds API historical odds | budget authorization required |
| Schedule/status/results/stats | NBA Stats public endpoints through approved client contract | provider access/terms review required |
| Paid stat fallback | BALLDONTLIE or equivalent | not authorized; evaluate only after explicit approval |
| SportsDataIO NBA | none for normal NBA runtime | legacy/trial evidence only |

The combined strategy is domain-specific, not one-provider-for-everything. The Odds API is the NBA odds authority candidate; NBA Stats is the non-odds source candidate; owned canonical tables remain the internal authority after import and validation.

## NBA-01C BallDontLie Candidate Update

NBA-01C-PREP adds BallDontLie as the current candidate non-odds NBA stat provider without making provider calls or activating NBA production.

| Domain | NBA-01C candidate | Status |
| --- | --- | --- |
| Games / results / players / player stats / active players / injuries | BallDontLie ALL-STAR | Candidate ongoing non-odds source after GOAT bootstrap; production NBA inactive. |
| Box scores / advanced stats / lineups / standings / season averages | BallDontLie GOAT 48-hour bootstrap | Prep ready; capture only after explicit trial START. |
| Odds / historical prices | The Odds API | Remains NBA market authority; no additional historical odds spend in NBA-01C-PREP. |
| SportsDataIO NBA | Legacy/trial only | Not expanded. |

The expected post-trial minimum architecture is The Odds API plus BallDontLie ALL-STAR plus owned GOAT bootstrap history, unless replay proves GOAT-only live domains are materially required.

## NBA-01C Final Recovery Update

NBA-01C-RECOVER completed the GOAT historical bootstrap from durable manifest state after PC/network restart. The owned foundation now contains 3,710 BallDontLie canonical games/results, 5,612 player identities, 128,353 normal player-game stat rows and 358,195 advanced-stat rows across 2022-23, 2023-24 and 2024-25. All completed provider pages were preserved, failed DB persistence was retried from raw payload without provider refetch, and NBA production remains inactive.

| Domain | Certified role after NBA-01C-RECOVER | Status |
| --- | --- | --- |
| Odds / market prices | The Odds API | NBA odds authority candidate; historical price foundation preserved. |
| Games / results / player stats | BallDontLie | Historical sports-data foundation certified; forward runtime candidate. |
| Advanced stats | BallDontLie GOAT | Historical bootstrap captured; shadow feature candidates for NBA-02. |
| Box scores | BallDontLie GOAT | Endpoint returned 0 rows with current request shape; non-core gap. |
| Lineups / plays / props | Deferred | Not imported; not required for NBA-02 core replay entry. |
| SportsDataIO NBA | Legacy/trial only | Not expanded. |

Subscription recommendation: `DOWNGRADE_TO_ALL_STAR_RECOMMENDED`. GOAT live usage is not currently required unless NBA-02 or later production certification proves a GOAT-only domain is necessary.

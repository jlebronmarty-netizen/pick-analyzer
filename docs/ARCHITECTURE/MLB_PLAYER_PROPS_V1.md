# MLB Player Props V1

Status: `PLAYER_PROPS_FOUNDATION_ONLY`

Observation time: `2026-08-11T17:18Z`

Production endpoints:

- `/api/mlb/player-props/readiness`
- `/api/mlb/player-props/provider-audit`
- `/api/mlb/player-props/mapping-diagnostics`

All certification reads reported `providerCallsMade=0` and `remoteMutationsMade=0`.

## Readiness Evidence

| Field | Value |
| --- | ---: |
| Props audited | 18 |
| Pitcher props audited | 7 |
| Batter props audited | 11 |
| Settlement-ready props | 18 |
| Current odds-ready props | 0 |
| Production-ready props | 0 |
| Blocked props | 18 |
| Overall status | `PROVIDER_ODDS_BLOCKED` |

## Stored Foundation

| Dataset | Rows |
| --- | ---: |
| MLB players | 7,389 |
| Player mappings | 7,463 |
| Player stats | 47,255 |
| Historical games | 2,430 |
| Historical lineups | 76,135 |
| Historical pitcher appearances | 20,870 |
| Historical batter appearances | 189,311 |
| Historical prop odds rows | 11 |
| Current prop odds rows | 0 |
| Opening prop odds rows | 0 |
| Closing prop odds rows | 0 |
| Current lineup rows | 0 |

## Blocking Reasons

| Blocker | Count |
| --- | ---: |
| `NO_CURRENT_SPORTSBOOK_PROP_ODDS` | 18 |
| `NO_OPENING_PROP_LINES` | 18 |
| `NO_CLOSING_PROP_LINES` | 18 |
| `NO_CURRENT_CONFIRMED_LINEUP_CONTEXT` | 18 |
| `PROP_PREDICTION_CONTRACT_NOT_ACTIVE` | 18 |
| `PROP_LEARNING_LABELS_NOT_ACTIVE` | 18 |
| `PROP_OFFICIAL_PICKS_DISABLED` | 18 |

## Product Policy

Player props remain unavailable for production recommendations.

No player-prop prediction rows, Official Picks, learning labels, calibration rows, sportsbook-price substitutions or settlement automation were activated by MLB Final Closeout.

## Recommended Future Epic

`PLAYER_PROPS_PILOT_V1`

Scope should be pitcher strikeouts and pitcher outs recorded first, only after:

- explicit provider budget approval;
- current prop lines and prices are stored;
- opening and closing line evidence exists;
- player identity crosswalks remain collision-free;
- current lineup/starter context is available;
- prop settlement labels are deterministic;
- shadow replay/calibration passes without production leakage.

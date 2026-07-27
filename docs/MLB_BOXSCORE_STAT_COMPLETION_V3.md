# MLB Boxscore And Stat Completion V3

Status: local reconciliation contract prepared; production stat completion requires separately approved import execution.

This phase does not call providers, import rows, mutate production data, generate retrospective predictions, rebuild features, seed epochs or settle predictions.

## Stored State

From Phase A1:

- Team/game stat rows: 2926
- Player stat rows: 47232
- Boxscore rows: 2926
- Completed event rows: 4012
- Starting/lineup rows: 27
- Injury rows: 0

Stored stat coverage is useful but not complete for every completed MLB event. Pitch count, relief appearance detail and exact starter context are available only where source rows contain the fields or existing starter evidence exists.

## Supported Stat Domains

The completion contract covers:

- team game stats
- player game stats
- batting
- pitching
- fielding where provider/source rows expose it
- inning scores where event metadata exposes it
- starting pitchers from stored starter evidence
- relief appearances where pitcher appearance rows support it
- recorded outs
- strikeouts
- walks
- hits allowed
- earned runs

Pitch count is optional and must remain null/unavailable when source evidence does not provide it.

## Reconciliation Rules

Team stat reconciliation:

- every stat row must map to one canonical MLB event
- home and away team stats must match canonical teams
- final score totals must reconcile to `game_results` before settlement use
- missing final result blocks score reconciliation but does not delete stats

Player stat reconciliation:

- every row must map to one canonical player or remain unresolved/review-required
- provider player IDs must never be guessed from name-only evidence
- duplicate player-game rows are rejected by deterministic provider stat row ID or natural key
- natural-key collisions are review candidates, not automatic overwrites

Pitching-specific reconciliation:

- recorded outs must use integer outs, not floating innings strings
- direct outs and innings-derived outs conflicts are quarantined
- starter rows require pregame or official source evidence
- relief appearances must not be promoted to starting pitcher evidence

## Deterministic Keys

Team stat natural key:

`mlb_team_stat:{provider}:{provider_game_id}:{team_id}:{stat_scope}`

Player stat natural key:

`mlb_player_stat:{provider}:{provider_game_id}:{provider_player_id}:{stat_scope}`

Boxscore natural key:

`mlb_boxscore:{provider}:{provider_game_id}:{team_id}:{boxscore_version}`

## Import Execution Plan

Execution remains blocked until approved.

Plan:

1. Read completed MLB events missing team/player stat coverage.
2. Group gaps by event date and source provider.
3. Dry-run at most 3 dates per review.
4. Validate event identity and final-result availability.
5. Validate player identity coverage.
6. Reject duplicate stat IDs and natural-key collisions.
7. Upsert only after explicit approval.
8. Postcheck stat counts, duplicate count, unresolved player count and result/stat consistency.

## Feature Readiness Boundary

Stats can feed feature rebuild readiness only after:

- event identity is canonical
- stat rows are source-timestamped
- player identity is deterministic or marked unresolved
- as-of timestamp can be reconstructed without future leakage
- completed-event final evidence is not used as pregame input

## Certification

- `MLB_BOXSCORE_COMPLETION_V3_READY_FOR_IMPORT`
- `MLB_STAT_RECONCILIATION_V3_PASS`
- Provider calls: 0
- Remote mutations: 0
- Production mutations: 0
- Historical imports executed: 0
- Feature rebuilds executed: 0
- Retrospective predictions generated: 0

# MLB Market Coverage & Label Integrity Audit — 2026-09-18

Status: `RESEARCH-ONLY`

Canonical tracker: `docs/research/MLB_MARKET_MODEL_TRACKER.md`

## Scope

This audit closes the first-pass coverage inventory for standard MLB player-prop outcome families currently supported by The Odds API.

It does **not** authorize Official Picks, APOSTAR, production promotion, historical Odds API spend, or any ROI/EV/CLV claim.

## Markets blocked by outcome / settlement integrity

### Batter Runs Scored — BLOCKED_LABEL_ATTRIBUTION

Existing Retrosheet play reconstruction reproduces the total number of runs at the game/season level:

- official 2025 runs: **21,596**
- parser play runs: **21,596**

However, player attribution is incomplete.

A scorer reconstruction using explicit Retrosheet advances plus base-state identities produced:

- 2,430 games audited
- only 1,443 games with exact attributed-run totals
- 987 games with attribution mismatch
- **1,409 explicit advances to home with missing runner identity**
- maximum single-game attribution difference: 6 runs

Therefore the existing data can certify *how many* runs scored, but cannot certify *which player* scored all of them.

Do not train or validate `batter_runs_scored` until runner identity is recovered for all scorer events or another exact per-player game outcome source is certified.

State: `BLOCKED_LABEL_ATTRIBUTION`.

### Batter RBIs — BLOCKED_LABEL_SEMANTICS

The current Retrosheet game reconstruction stores batter-appearance `rbi` as the parser's total `runs` on the play.

This is not an official-RBI contract. It does not fully implement official RBI exclusions/credit rules.

Do not use this field as the `batter_rbis` target.

State: `BLOCKED_LABEL_SEMANTICS`.

### Batter Hits + Runs + RBIs — BLOCKED_DEPENDENCY_LABELS

Hits are certified, but this combined market requires exact per-player game:

- hits;
- runs scored;
- RBIs.

Because Runs Scored and RBIs are not currently certified, `batter_hits_runs_rbis` is also blocked.

State: `BLOCKED_DEPENDENCY_LABELS`.

### Batter Stolen Bases — BLOCKED_LABEL_ATTRIBUTION

The current Retrosheet batter-appearance parser marks:

`stolenBase = /SB/.test(playEvent)`

That establishes that a stolen-base event occurred during the plate appearance, but it does not certify that the current batter was the runner who stole the base.

Do not use this boolean as a batter stolen-base target.

State: `BLOCKED_LABEL_ATTRIBUTION`.

### Batter First Home Run — BLOCKED_SETTLEMENT_SEMANTICS

Raw Statcast can identify the first home-run hitter in games with at least one HR:

- 2025 games with >=1 HR: 2,132
- 2026 games with >=1 HR in current raw coverage: 1,973

However, the market is Yes/No and sportsbook settlement for games with **no home run** is not certified in the current pricing/outcome contract.

Conditioning evaluation on games that later had a home run would be postgame selection leakage.

Do not model or score `batter_first_home_run` until no-HR settlement semantics are explicitly certified for the target sportsbook/market feed.

State: `BLOCKED_SETTLEMENT_SEMANTICS`.

### Batter Fantasy Score — DFS_ONLY_DEFERRED

The Odds API describes `batter_fantasy_score` as DFS-only.

No canonical scoring-system contract is frozen in Pick Analyzer for this market family. Different DFS scoring systems may not be interchangeable.

State: `DFS_ONLY_DEFERRED`.

## Identity findings

### Retrosheet 2025 lineup identity

Canonical 2025 crosswalk surfaces already exist:

- `mlb_ml_lineup_retro_2025_v3`
- `mlb_ml_game_map_2025_v3`
- `mlb_ml_lineup_mlbam_2025_v3`

Exact game/team/batting-order mapping produced:

- 661 Retrosheet lineup player IDs
- 643 with a unique MLBAM mapping
- 18 ambiguous mappings
- 0 completely unmapped

Ambiguous mappings must remain fail-closed.

### SportsDataIO 2026 identity

`sport_player_stats` contains exact SportsDataIO provider player IDs and game-level Runs/RBI/SB outcomes in 2026.

However:

- `pick2_mlb_players.legacy_sport_player_id` is empty for all 1,794 rows;
- exact normalized-name mapping from 1,292 SportsDataIO game-level player identities to `pick2_mlb_players` resolved only 210 uniquely;
- `sport_lineups` contains only 27 MLB lineup rows across 15 events, insufficient for a season-wide provider-ID-to-MLBAM crosswalk.

Do not create a fuzzy cross-provider identity map merely to open external validation.

## Alternate markets

MLB `*_alternate` props reuse the same underlying outcome families as the standard props.

They should not be treated as independent outcome models.

After a base outcome family is frozen, alternate lines may be evaluated in a separate **line-specific / price-aware** calibration layer while preserving the frozen outcome model.

## Current gate

Proceed with first-pass research for outcome families that already have exact labels.

For the blocked markets above, return only after:

- a certified per-player Runs outcome surface exists;
- an official RBI parser/outcome contract exists;
- stolen-base runner identity is exact;
- first-HR no-event settlement is certified;
- or a provider identity/outcome contract supplies equivalent exact evidence.

Historical Odds API credits consumed by this audit: **0**.
Official Picks writes: **0**.
APOSTAR activation: **false**.
Production promotion: **false**.

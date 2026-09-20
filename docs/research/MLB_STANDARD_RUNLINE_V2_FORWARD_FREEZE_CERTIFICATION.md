# MLB Standard Run Line V2 — Forward Freeze Certification

**Date:** 2026-09-20  
**Repository:** `jlebronmarty-netizen/pick-analyzer`  
**Scope:** research/shadow-only prospective freeze  
**First prospective runtime date:** 2026-09-21

## Frozen candidates

The runtime preserves the existing frozen candidates without retuning:

- `rl_v2_core_fixed_v1`
- `rl_v2_transfer_fixed_v1`
- `rl_v2_broad_union_fixed_v1`

### Core

`0.54 <= market_p_dog < 0.58`

`(recent_form + fatigue_travel) / sqrt(2) >= 1.0002553572466371`

### Transfer

`dogfav_hand = L/R`

`(market_z_v2 + history + fatigue_travel) / sqrt(3) >= 0.889684454234473`

Frozen market normalization:

- mean = `0.57629591863738`
- sd = `0.0754955595992703`
- `market_z_v2 = (market_p_dog - mean) / sd`

Broad Union = Core OR Transfer.

## Exact lineage recovery

Canonical reference window: 2026-09-01 through 2026-09-10, 103 V2 matrix rows.

### DOG component orientation

Cross-year PREGAME component authority is HOME-oriented.

Runtime rule:

- HOME dog -> use component z as-is
- AWAY dog -> multiply HOME-oriented z by -1

Read-only parity:

- Recent Form: **103/103 exact**
- History: **103/103 exact**
- Fatigue/Travel: **103/103 exact**

Dynamic strict-prior reconstruction from raw xyear history:

- Recent Form: **103/103 exact**, max diff <= 2.23e-16
- Fatigue/Travel: **103/103 exact**, max diff <= 6.0e-15

### Handedness

`dogfav_hand` semantics are:

`DOG starting-pitcher hand / FAVORITE starting-pitcher hand`

Parity: **103/103 exact**.

### Market proxy

Canonical 2026 V2 policy:

`MLB_RUNLINE_MARKET_2026_V1_EARLIEST_CAPTURED_PAIRED_MODAL_PROXY`

Exact recovered construction:

1. identify the canonical target by teams + scheduled start;
2. for each sportsbook, take its **first complete paired run_line snapshot**;
3. preserve that book-open pair even if the book later changes line;
4. group book opens by paired `home_line / away_line`;
5. choose the modal paired line;
6. on equal book count, choose the modal cohort with the earliest
   `latest_book_open_snapshot_at`, then earliest first timestamp;
7. average American prices across books in the selected modal cohort;
8. convert the two average American prices to implied probabilities;
9. de-vig the pair;
10. the +1.5 side is DOG and receives `market_p_dog`.

Full reference parity:

- target identity: **103/103**
- paired modal line: **103/103**
- home/away average prices: **103/103**
- book count: **103/103**
- earliest/latest opening timestamps: **103/103**
- resulting `market_p_dog`: **103/103 exact**
- max `market_p_dog` diff: **0**

Historical doubleheader evidence confirmed that canonical identity must use
teams + scheduled start rather than stale legacy provider gamePk metadata.

## Prospective runtime

Job type:

`runline_v2_standard_forward_freeze_v1`

Runtime:

- existing Run Line V2 cron;
- fixed new-write window: **10:45-10:59 America/Puerto_Rico**;
- existing cron invocation: **10:46 PR**;
- no new Odds API request;
- reads already-captured product-primary `run_line` snapshots;
- full slate is frozen, including non-selected and non-evaluable rows;
- missing data remains explicit / fail-closed;
- first valid job is immutable and later calls reuse/no-op.

The standard freeze and HOME +1.5 alternate freeze are isolated. Failure in one
does not erase or prevent the other from executing.

## Feature sources

- slate: `pick2_mlb_games`;
- market identity: canonical teams + scheduled start within 10 minutes;
- standard market quotes: `sports_odds_snapshots`, read-only;
- team history: `mlb_ml_xyear_team_game_v1`, strict prior date;
- starter history/hand: `mlb_ml_xyear_pitcher_game_v1`, strict prior date;
- normalization: `mlb_ml_xyear_feature_stats_v1` and `mlb_ml_xyear_component_stats_v1`;
- target venue: canonical home venue for normal-site games;
- MLB Official is used only to validate current schedule, probable starters and special-site venue state.

Special/neutral-site games do not invent travel geometry; target travel/timezone
inputs are left unavailable where the standard home venue cannot be used safely.

## Safety

- research/shadow only;
- production eligible: false;
- Official Picks unchanged;
- APOSTAR disabled;
- no ROI certification;
- no EV certification;
- no formula/threshold retune;
- historical Odds API credits consumed: 0;
- prospective runtime adds **0 new sportsbook provider calls**.

## Disposition

`STANDARD_RUNLINE_V2_FORWARD_FREEZE_READY = YES`

The only remaining operational gate after merge is the first genuine prospective
freeze on 2026-09-21.

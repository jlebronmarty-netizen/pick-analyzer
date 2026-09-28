# MLB Postseason Compatibility Audit — 2026-09-28

Status: **RESEARCH/SHADOW ONLY**

## Objective

Allow the existing 2026 MLB research/shadow runtimes to observe postseason targets without
changing any model formula, threshold, historical metric, Official Pick behavior, or APOSTAR state.

MLB StatsAPI game types used by this project:

- `R` — Regular Season
- `F` — Wild Card
- `D` — Division Series
- `L` — League Championship Series
- `W` — World Series

The model-eligible target policy is therefore `R/F/D/L/W`.

## Critical blocker found

Before this repair, active runtime paths were regular-season-only in code:

- MLB Official schedule provider queried `gameType=R`;
- canonical slate preflight persisted every inserted game as `game_type='R'`;
- Standard Run Line filtered canonical and Official games to `R`;
- HOME +1.5 filtered Official games to `R`;
- approved-prop daily evaluation queried only `game_type='R'`;
- approved-prop sportsbook capture rejected non-`R` games;
- approved-prop future recovery queried only `game_type='R'`;
- BALLDONTLIE approved-prop fallback forced `season_type=regular`;
- opening-consensus Moneyline mapping forced BALLDONTLIE games to regular season.

Therefore the pre-repair runtime was **not postseason compatible**, independently of model quality.

## Repair boundary

This change modifies only target-slate/capture eligibility.

It does **not**:
- retune formulas or thresholds;
- rewrite historical results;
- backfill missed freezes;
- relabel diagnostic evidence as external;
- modify Official Picks;
- enable APOSTAR;
- promote any model to production.

Canonical `pick2_mlb_games.game_type` now preserves the actual MLB game type.

## Compatibility classification

### Pick Analyzer Moneyline V2
Runtime plumbing: **POSTSEASON_TARGET_COMPATIBLE after this repair**.
Evidence class: `POSTSEASON_SHADOW_DOMAIN_SHIFT`.

### Standard Run Line V2
Runtime plumbing: **POSTSEASON_TARGET_COMPATIBLE after this repair**.
Evidence class: `POSTSEASON_SHADOW_DOMAIN_SHIFT`.
Core/Transfer/Broad formulas and thresholds remain unchanged.

### HOME +1.5 Alternate
Runtime plumbing: **POSTSEASON_TARGET_COMPATIBLE after this repair**.
Evidence class: `POSTSEASON_SHADOW_DOMAIN_SHIFT`.
A real exact HOME +1.5 pregame quote remains mandatory.

### Approved prop models
Runtime plumbing: **POSTSEASON_TARGET_COMPATIBLE after this repair** for exact captured markets.
Evidence class: `POSTSEASON_SHADOW_DOMAIN_SHIFT`.
Exact market + line + direction isolation remains mandatory.

### Legacy Pick Analyzer ML selector
Not independently promoted by this audit. Any postseason output remains shadow/domain-shift evidence.

## History handling

Strict prior history remains:
`source_game_date < target_game_date`.

Completed prior postseason games may enter later history only through existing append/materialization
paths. Same-date doubleheader leakage remains forbidden.

Postseason outcomes must be tracked separately from regular-season forward evidence and cannot be used
to retune 2026 thresholds.

## Independent engines

- Pick Edge still has explicit `gameType=R` in freeze/settlement and requires a separate repo repair.
- Equilizer's existing 130/150 cohort must not be completed with postseason games. Any playoff E2 run
  must be a separate shadow stream and must not increment the original counter.
- Pulpy MLB Official outcome capture still has `gameType=R` and requires a separate repo repair.

## State after this Pick Analyzer repair

- Pick Analyzer: `POSTSEASON_READY_SHADOW_ONLY`
- Pick Edge: `POSTSEASON_BLOCKED_GAME_TYPE_R`
- Equilizer original cohort: `REGULAR_SEASON_ONLY_DO_NOT_ENROLL_POSTSEASON`
- Pulpy: `POSTSEASON_BLOCKED_OUTCOME_CAPTURE_GAME_TYPE_R`

# MLB Moneyline Context Components V6 — Certification

**Date:** 2026-09-20  
**Repository:** `jlebronmarty-netizen/pick-analyzer`  
**Canonical Supabase:** `ynuocvexviorgdjrfthw`  
**Scope:** research warehouse / daily ingestion only

## Purpose

Recover the five PREGAME component families that remained NULL after the Starter lineage repair,
without reconstructing Lineup/Matchup from postgame data.

Recovered families:

- Offense
- Bullpen
- Home/Away
- Fatigue/Travel
- Defense Context

Lineup/Matchup remains intentionally NULL when no timestamped pregame lineup evidence exists.

## Gold-standard parity — 2026-09-14

All formulas were reconstructed from strict-prior data and compared to the stored Sep14 gold standard
before production DDL.

Feature-cell parity:

- Offense: **120/120 exact**, max diff **0**
- Bullpen: **120/120 exact**, max diff <= **2.22e-16**
- Home/Away: **60/60 exact**, max diff **0**
- Fatigue/Travel: **100/100 exact**, max diff **0**
- Defense Context: **30/30 exact**, max diff **0**

Component-score parity:

- Offense: **10/10 exact**
- Bullpen: **10/10 exact**
- Home/Away: **10/10 exact**
- Fatigue/Travel: **10/10 exact**
- Defense Context: **10/10 exact**

Maximum component-score difference across the five families was below **1.2e-16**.

All source filters use `source_game_date < target_game_date`; same-day Game 1 is excluded from Game 2.

## Exact recovered semantics

### Offense
- OPS proxy = `(H + BB)/(AB + BB) + TB/AB`
- K% = prior K / prior PA
- Statcast hard-hit% and barrel% from strict-prior team Statcast aggregates
- handedness K-rate and hard-hit% against the opposing preserved pregame starter hand

### Bullpen
- strict-prior non-starter appearances only
- RA9, WHIP, K%, BB%
- L7 RA9 uses prior rows with `game_date >= target_date - 7`
- prior two-day workload uses pitch count with `game_date >= target_date - 2`

### Home/Away
- designated home team: prior home games only
- designated away team: prior road games only
- win%, runs scored/game, runs allowed/game

### Defense Context
- prior errors/game
- prior home-win rate at the target venue

### Fatigue/Travel
- rest days from the last strict-prior game
- games in prior seven calendar days
- road-trip game number based on consecutive prior road games since the most recent prior home game
- 48h travel distance from previous venue to current venue
- 48h timezone change
- historical geodesic radius constant: `3958.761` miles

## Sep18/Sep19 production readback

Both dates remain:

- games: **15**
- feature values: **1,350**
- component rows: **150**
- Team Strength: **15/15**
- Recent Form: **15/15**
- Offense: **15/15**
- Bullpen: **15/15**
- Home/Away: **15/15**
- Fatigue/Travel: **15/15**
- Defense Context: **15/15**
- History: **15/15**
- Lineup/Matchup: **0/15**
- zero-populated non-null component scores: **0**
- cutoff violations: **0**
- starter evidence timing violations: **0**

Starter remains evidence-gated:

- Sep18: **12/15**
- Sep19: **13/15**

## V7 daily audit hardening

`mlb_ml_daily_materialization_audit_v1` now persists counts for all five recovered families.

`mlb_ml_xyear_materialize_pregame_v4` marks the warehouse sync COMPLETE only when:

- source/feature/value/component row counts are complete;
- Team Strength, Recent Form, Offense, Bullpen, Home/Away, Fatigue/Travel,
  Defense Context and History are populated for every source game;
- no zero-populated component has a non-null score;
- feature cutoff violations = 0;
- starter evidence timing violations = 0.

Starter and Lineup remain route/evidence gates and do not falsely make the warehouse sync incomplete.

## Idempotence

After stabilization, a repeated joint Sep18/Sep19 materialization produced:

- changed component rows: **0**
- maximum score difference: **0**

The first Sep18 hash transition after V6 was a one-time state transition from the pre-V6 NULL context
surface. It is documented and is not ongoing mutation.

## Preserved boundaries

Pre/post digests are unchanged:

- forward tracker rows: **69**
- forward full-row digest: `0ec434e1ca55b9cfc88dab0556a2f410`
- Sep18/Sep19 prior digest: `1d93520502e45f4a6ee2c13808910ec4`
- `pregame_high_conf_home_v2` registry digest: `edcc79d80888bd35edc23748ed6e3705`

Also unchanged:

- `STARTER_POPULATION_AUTHORITY = PRIOR_STARTS_ONLY`
- `mlb_ml_xyear_feature_stats_v1` remains the scoring authority
- frozen formula/routes/thresholds
- Official Picks
- APOSTAR disabled
- historical Odds API credits consumed: 0
- production betting eligibility: false

Supabase advisors were re-run after DDL. The project retains pre-existing RLS/performance advisory
inventory; no new blocker was introduced by this context-component extension.

## Disposition

`MLB_ML_XYEAR_CONTEXT_COMPONENTS_V6 = CERTIFIED`

The daily PREGAME warehouse now reconstructs every parity-certified component except Lineup/Matchup,
which remains correctly fail-closed without preserved pregame lineup evidence.

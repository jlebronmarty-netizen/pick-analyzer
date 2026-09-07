# MLB-DATA-02R-R2E Component Interface Refactor Plan Audit

## Verdict

`MLB_DATA_02R_R2E_COMPONENT_INTERFACE_REFACTOR_PLAN_CERTIFIED`

This is a read-only refactor plan. No live code was modified. No provider calls, production DML, production DDL, Official Pick writes, automation changes, cron changes, settlement, migration application or push occurred. The plan does not claim R2B live readiness.

## Reason For R2E

The prior live manual refresh attempt used the certified frozen package at `c10734f614cdb332ccee2c601e19fc0a9087ec46`. It proved the R2D wrapper guard layer is present, but every production-capable stage returned `WRAPPER_READY_REQUIRES_STAGE_IMPLEMENTATION`. A metadata-only adapter would create false readiness, so the next safe step is to expose real bounded component interfaces before any new live execution attempt.

## Inventory Summary

| Stage | Component | Current State | Refactor Need |
| --- | --- | --- | --- |
| 01 schedule sync | `scripts/mlb-data-02h-2026-current-foundation.mjs`, MLB Official service | MLB Official schedule logic embedded in broad current-foundation script | Export bounded schedule API with provider injection |
| 02 native reconciliation | `scripts/mlb-data-02h-2026-current-foundation.mjs` | Native game/player classify and insert logic embedded in script | Extract read/write split with eligible `game_pk` scope |
| 03 raw Statcast reconciliation | `scripts/mlb-data-02h-2026-current-foundation.mjs`, Statcast service | Cache/date-driven Statcast ingestion embedded in broad script | Extract game-bounded cache-first raw interface |
| 04 feature refresh | `scripts/mlb-data-02h-2026-current-foundation.mjs`, `scripts/mlb-data-01d-r1i-partial-feature-dml-resume.mjs` | Feature generation/persistence is script-owned and season/resume oriented | Deeper extraction to target-game feature service |
| 05 starter readiness | `scripts/mlb-data-02i-current-moneyline-dry-inference-prep.mjs` | Readiness classifier is embedded but pure | Export bounded function |
| 06 moneyline inference | `scripts/mlb-data-02i-current-moneyline-dry-inference-prep.mjs`, model artifact | Feature vector and Champion inference embedded in dry script | Extract pure inference service with 76-feature parity |
| 07 prediction persistence | `scripts/mlb-data-02j-r3-current-moneyline-prediction-dml-retry.mjs` | Persistence classifier uses fixed frozen artifact | Extract runtime prediction persistence service |
| 08 odds acquisition | `scripts/mlb-data-02m-r2-fresh-market-sample-acquisition.mjs` | One-call The Odds API sample and parsers embedded in script | Extract provider-injected h2h acquisition API |
| 09 market persistence | `scripts/mlb-data-02m-r3-fresh-market-sample-persistence.mjs` | Mapping/observation persistence uses frozen artifact | Extract normalization, classification and persistence |
| 10 native value evaluation | `scripts/mlb-data-02n-current-moneyline-value-evaluation-prep.mjs`, `scripts/mlb-data-02o-r3-native-value-persistence.mjs` | Value math and persistence split across scripts | Extract calculation and persistence interfaces |
| 11 Official Pick policy | `scripts/mlb-data-02p-r1-official-pick-execution-prep.mjs` | Policy V1 classifier is embedded and pure | Export policy evaluator and payload builder |
| 12 Official Pick persistence | `scripts/mlb-data-02p-r2-official-pick-persistence-execution.mjs` | Persistence classifier uses fixed source artifact | Extract immutable persistence interface |
| 13 Value Board readback | `src/services/pick2-mlb-value-board.service.ts` | Already service-backed and read-only | Add optional bounded read filters if needed |

## Canonical Callable Pattern

Future production-capable stage functions should accept:

```ts
executeStage({
  mode,
  runContext,
  eligibleGamePks,
  runAsOf,
  providerBudget,
  dmlCap,
  checkpoint,
  injectedEvidence
})
```

The exact argument shape may vary by stage, but every callable stage must carry the same safety concepts: frozen run identity, explicit mode, current-slate `game_pk` containment, provider budget accounting, per-table DML caps, checkpoint state and serializable stage evidence.

## Mode Contract

`DRY_RUN` performs no provider calls and no production writes unless a provider fixture is explicitly injected into the real parser/business logic.

`LIVE_EXECUTE` requires separate direct R2 authorization plus stage authorization, budget/cap checks and checkpoint state.

`READBACK_ONLY` performs no provider calls and no writes.

## Stage Interface Plan

Schedule should expose `getCurrentSlateSchedule()` with run date, as-of, mode, provider budget and injected MLB Official client. It returns game identity, start time, status, teams, doubleheader identity, starter evidence and pregame classification.

Native reconciliation should expose `reconcileNativeIdentity()` over frozen schedule evidence and eligible `game_pk` values. It returns `INSERT_ELIGIBLE`, `REUSE_NO_OP` and `BLOCK_CONFLICT` plans, with actual write counts only in `LIVE_EXECUTE`.

Raw Statcast should expose `reconcileCurrentSlateStatcast()` with eligible games, dependency dates/windows, cache policy, provider budget, cap and checkpoint. It must write only to `public.pick2_raw_mlb_statcast_pitches` and must reject unrestricted season backfill from R2.

Feature refresh should expose target-game-only generation for snapshots, team, starter, bullpen, batter, matchup and first-inning rows. Historical data may be read, but writes must be limited to target `game_pk` rows and per-domain caps.

Starter readiness should expose a pure classifier returning `CONFIRMED`, `PROBABLE`, `UNKNOWN` or `CHANGED` with reasons and evidence.

Inference should expose pure Champion inference from a 76-feature vector and model artifact, returning probabilities, input digest and range audit with no persistence.

Prediction persistence should be separate from inference and classify immutable rows as insert, reuse or conflict.

Odds acquisition should expose a one-call-capped The Odds API interface for `baseball_mlb`, `h2h`, American odds, with provider response digest and call accounting.

Market should split normalize, match/crosswalk, classify persistence and persist operations.

Value should split calculation, persistence classification and persistence, reusing the certified same-book no-vig, edge and unit-EV math.

Official Pick policy should be pure and return policy status, reason codes, risk flags and blockers under `MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1`.

Official Pick persistence should be immutable and separate from policy evaluation.

Value Board readback should remain read-only and service-backed, optionally accepting operating date/as-of filters for executor readback.

## Implementation Waves

1. `WAVE_1_PURE_READ_ONLY_INTERFACES`: schedule, starter, inference, Official Pick policy and Value Board readback.
2. `WAVE_2_BOUNDED_PLANNING_CLASSIFICATION`: native identity, raw Statcast and feature generation/classification.
3. `WAVE_3_BOUNDED_PERSISTENCE_INTERFACES`: predictions, market mappings/observations, values and Official Picks.
4. `WAVE_4_EXECUTOR_BINDING`: wire the R2A executor to real interfaces without broad script spawning.
5. `WAVE_5_REAL_DRY_INTEGRATION_CERTIFICATION`: run a frozen current-slate dry integration using real code paths, fixture/provider injection and dry DB repositories.
6. `WAVE_6_SEPARATE_LIVE_AUTHORIZATION`: only after direct authorization, execute one bounded current-slate live refresh.

## Minimum Live-Capable Change Set

The minimum future change set is a shared stage contract module, bounded schedule/native/raw/feature interfaces, pure starter/inference/policy interfaces, bounded prediction/market/value/Official Pick persistence interfaces, Value Board readback adapter, executor binding and real dry integration certification.

## Risk Notes

The highest-risk extractions are raw Statcast and feature refresh because the current logic can operate across broad dates/seasons and has write paths. Native reconciliation, prediction persistence, market persistence, value persistence and Official Pick persistence are also high production-behavior or DML-semantics risk. Starter readiness, inference, odds acquisition and policy are lower write risk but must preserve model and provider semantics exactly.

## Real Certification Plan

Future certification must use real code paths. Allowed test methods are provider fixture injection into real parsers, DB repository injection into real classifiers, static scope assertions and negative tests for out-of-scope games, cap excess and conflicts.

Forbidden certification methods are synthetic PASS constants, metadata-only readiness and mock success bypasses.

## Remaining Blockers

R2B live execution remains blocked until the above interfaces are implemented and dry-certified. The existing R2D wrapper file is a scope guard, not a real stage adapter. Broad 02H and R1I scripts must be extracted before R2 may safely invoke native/raw/feature work for a frozen current-slate game set.

## Recommended Next Phase

`MLB_DATA_02R_R2F_COMPONENT_INTERFACE_REFACTOR_IMPLEMENTATION`

Recommended next instruction: implement Wave 1 and Wave 2 bounded interfaces only, preserve CLI compatibility, run real dry certification, and do not execute live providers or production DML.

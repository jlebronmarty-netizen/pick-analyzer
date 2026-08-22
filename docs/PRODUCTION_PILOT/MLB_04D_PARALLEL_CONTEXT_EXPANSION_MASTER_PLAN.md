# MLB-04D Parallel Context Expansion Master Plan

Classification: `MLB_04D_PARALLEL_CONTEXT_EXPANSION_MASTER_PLAN_CERTIFIED`

MLB-04D audits the remaining MLB Chat-Method context gaps after MLB-04C-R6 and Observation #3. It is a master-plan and certification phase only. It does not enrich Observation #1, Observation #2 or Observation #3, does not create a Chat probability, does not change the raw or calibrated production models, and does not activate props, NRFI/YRFI, Official Picks or scheduler automation.

## Certified Baseline

- Local, origin and production commit: `337bea82207874302ff2834ad7e338f69ab28493`
- Scorecard V1: frozen historical Observation #1 only.
- Scorecard V2: production ready.
- Current real V2 completeness: `3 / 7 = 0.4286`.
- Working live components: `OFFENSE_EDGE`, `BULLPEN_EDGE`, `MARKET_VALUE`.
- Conditional component: `STARTER_EDGE`.
- Blocked or incomplete components: `LINEUP_EDGE`, `SPLIT_EDGE`, `CONTEXT_EDGE`.

## Track Audit

| Track | State | Readiness | Reason |
| --- | --- | --- | --- |
| A - Starting pitchers | Stored assignment table, stored lineup fallback and MLB Official probable-pitcher normalizer exist. Real observations can still show `UNKNOWN` when no active assignment or provider-side probable pitcher is present at capture time. | `PARTIAL_IMPLEMENTABLE` | The forward contract is clear, but player handedness and pitcher quality/recent-workload scoring are not fully certified for all active starters. |
| B - Lineups | `sport_lineups` supports starting-lineup rows, MLB Official live-feed batting order parsing exists, and projected lineups can be derived from stored season player stats for research only. | `PARTIAL_IMPLEMENTABLE` | Confirmed lineup capture is timing-sensitive and must not promote projected rows to confirmed. |
| C - Splits / handedness | Some pitcher/player handedness fields appear in types and cached provider metadata, but timestamp-safe batter/pitcher split provenance is not certified. | `AUDIT_ONLY` | `SPLIT_EDGE` must fail closed until as-of provenance and no-future-season contamination are proven. |
| D - Park / venue | MLB Official schedule venue identity is normalized in the current context lineage path; legacy SportsDataIO stadium context exists but SportsDataIO remains excluded from new MLB context capture. | `PARTIAL_IMPLEMENTABLE` | Park identity can be captured, but park factors require an approved temporally stable source. |
| E - Weather | No currently approved non-SportsDataIO MLB weather provider is certified for this path. Existing weather examples from legacy GamesByDate evidence cannot be reintroduced as a production dependency. | `EXTERNAL_PROVIDER_REQUIRED` | Weather requires a new approved provider/contract or explicitly certified stored forecast source. |
| F - Injuries | `sport_injuries` exists and the context path can read stored rows, but no approved active MLB injury source is certified. | `EXTERNAL_PROVIDER_REQUIRED` | Missing injuries must remain unknown, never inferred healthy. |
| G - Pitcher prop foundation | Pitcher-stat foundation, recorded-outs projection scaffolding, prop readiness routes and The Odds API `pitcher_outs` documents/evidence exist. | `PARTIAL_IMPLEMENTABLE` | Production readiness is blocked by current prop odds entitlement/identity, settlement, replay and calibration gates. |
| H - NRFI / YRFI foundation | Universal market catalog has first-inning contract, but first-inning result extraction, market odds, model and settlement remain blocked. | `AUDIT_ONLY` | Requires inning-score source and first-inning settlement before any prediction or product activation. |
| I - Forward observation continuity | MLB-04B snapshots and MLB-04C V2 scorecards are compatible with MORNING, FINAL_PREGAME and later POSTGAME result evaluation. | `READY_TO_IMPLEMENT` | Automation prep can be designed without creating new observations or mutating existing ones. |

## Starter Root Cause

Current V2 observations still frequently show `starter UNKNOWN` because of a combination of:

- `SOURCE_DATA_NOT_PRESENT`: MLB Official may not expose probable pitchers for every game at the capture moment.
- `TIMING_GAP`: `FINAL_PREGAME` can run before official lineups or probable pitchers are populated.
- `SOURCE_NOT_CONSUMED`: R6 fixed active assignment consumption for future snapshots only; earlier observations remain frozen.
- `ASSIGNMENT_NOT_PERSISTED`: no new starter acquisition write is authorized by this master phase.

## Implementation Packages

### Package A - Internal Context

Scope: starters, projected/confirmed lineups, splits audit, park identity.

Readiness: `PARTIAL`

This package can add forward-only capture contracts for active starter assignment state, stored/official lineup state and MLB Official venue identity. `SPLIT_EDGE` should remain audit-only until handedness/split provenance is certified. Park identity can contribute to context lineage; park-factor scoring should wait.

### Package B - External Context

Scope: weather and injuries.

Readiness: `EXTERNAL_DEPENDENCY`

This package should define provider contracts first. It must not call or integrate a new provider until human authorization chooses a source and budget. Missing weather and injuries remain explicit blockers.

### Package C - Market Expansion Foundation

Scope: pitcher props and NRFI/YRFI.

Readiness: `AUDIT_ONLY`

Pitcher props have partial data/model foundations but remain blocked from production by odds, settlement, replay and calibration gates. NRFI/YRFI remains blocked by first-inning result and market-odds foundations.

### Package D - Forward Automation

Scope: snapshot scheduling, result evaluation and ledger accumulation.

Readiness: `READY_TO_IMPLEMENT`

This package can prepare non-mutating automation contracts for MORNING, FINAL_PREGAME and POSTGAME result evaluation. Any real snapshot persistence remains separately authorization-gated by the existing MLB-04B route.

## Completeness Roadmap

- Current real completeness: `3 / 7 = 0.4286`.
- Projected after internal tracks: `5 / 7 = 0.7143` once starter and lineup are actually captured and scored from timestamp-safe evidence.
- Projected after external tracks: `7 / 7 = 1.0000` only after splits, park/weather/injury context are source-certified and scoring semantics are versioned.

These projections are not claimed as current capability. Components count only when source, capture and scoring contracts are certified.

## Context Edge Decision

Keep Scorecard V2 semantics unchanged for existing and near-term forward observations. `CONTEXT_EDGE` should remain a bounded composite of park, weather and injuries only after approved source contracts exist. If park/weather/injury scoring weights or subcomponent treatment materially changes, introduce `MLB_CHAT_METHOD_RESEARCH_SCORECARD_V3`.

Current decision: `SCORECARD_V3_REQUIRED = NO` for the master plan. V3 becomes required before changing `CONTEXT_EDGE` semantics.

## Dependency Graph

| Capability | Dependencies |
| --- | --- |
| Core ML / Run Line / Total | current odds, canonical events/results, model artifacts, exact-line selection, starter/offense/bullpen as optional research context |
| Chat Method | frozen MORNING/FINAL_PREGAME snapshots, V2/V3 scorecard, same-opportunity market evidence, final result ledger |
| Pitcher Props | starter identity, pitcher stat history, prop odds, player identity bridge, prop settlement, replay and calibration |
| NRFI / YRFI | both starters, top-order lineups, first-inning stats/results, park/weather, market odds, first-inning settlement |
| Official Picks | existing production recommendation policy, calibrated evidence, enough forward sample, no unsupported market promotion |
| Automation | protected snapshot scheduler, idempotent deterministic keys, result evaluation, review checkpoints |

## Safety Certification

- Provider calls: `0`
- Production DB mutations: `0`
- Prediction writes: `0`
- Current Era Shadow writes: `0`
- Chat research prediction writes: `0`
- Official Pick writes: `0`
- Settlement writes: `0`
- Learning writes: `0`
- Calibration writes: `0`
- Product writes: `0`
- SportsDataIO reintroduction: `NO`
- Production model changed: `NO`

## Recommended Execution Order

1. `MLB-04D-D_FORWARD_AUTOMATION_PREP`
2. `MLB-04D-A_INTERNAL_CONTEXT`
3. `MLB-04D-B_WEATHER_INJURY_SOURCE_CONTRACTS`
4. `MLB-04D-C_PROPS_NRFI_FOUNDATION`

Packages A and D can run in parallel because one improves context capture while the other prepares ledger continuity. Packages B and C should remain audit/contract-first until external source and market/settlement blockers are explicitly resolved.

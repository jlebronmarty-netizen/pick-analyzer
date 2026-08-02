# Mission Control Program V2

Status: Mission Control V1 implemented for production certification.

Baseline commit: `ddc79d7b4a5efa5068ff1e63bb68d95d84100e67`.

Mission Control V1 creates a durable, read-only command center for Pick Analyzer V2. It composes existing operational systems instead of replacing OE-003 scheduler, lifecycle, planner, provider budget, canonical acquisition or freshness SLA contracts.

Mission Control owns only current execution state, queueing, readiness summaries and stop conditions.

## Mission Taxonomy

## Source Boundaries

- Master Program: product vision, rules and release methodology.
- Master Roadmap: high-level planned direction.
- Mission Control: current execution state and next eligible work.
- Project Status: human-readable project journal.
- Certification artifacts: proof records.
- Mission Control Log: append-only mission history.

Categories:

- OPERATIONAL_READINESS
- MULTI_SPORT_DATA
- MULTI_SPORT_PREDICTION
- SETTLEMENT_AND_LEARNING
- PERFORMANCE_INTELLIGENCE
- DECISION_CORE_EVOLUTION
- MARKET_EXPANSION
- PRODUCT_EXPERIENCE
- AUTOMATION
- PROVIDER_INTEGRATION
- CERTIFICATION
- DOCUMENTATION
- TECHNICAL_DEBT
- EXTERNAL_DEPENDENCY

States:

- PLANNED
- READY
- ACTIVE
- PAUSED
- BLOCKED
- CONDITIONAL_PASS
- LOCALLY_COMPLETE
- DEPLOYED
- PRODUCTION_CERTIFIED
- SUPERSEDED
- CANCELLED
- UNKNOWN

Priorities: P0, P1, P2, P3, P4.

Execution modes:

- MANUAL_ONLY
- AGENT_ASSISTED
- AUTONOMOUS_ELIGIBLE
- AUTONOMOUS_ACTIVE
- EXTERNAL_WAIT
- READ_ONLY

Readiness states:

- NOT_READY
- CONDITIONAL
- READY
- ACTIVE
- PAUSED
- BLOCKED
- COMPLETE

Mission Control V1 may mark work READY. It must not mark any future mission ACTIVE.

## Current Mission Groups

- MC-00 Mission Control Foundation
- MC-01 Operational Readiness Closure
- MC-02 Multi-Sport Data Readiness
- MC-03 Multi-Sport Prediction Activation
- MC-04 Multi-Sport Settlement And Learning
- MC-05 Performance Intelligence
- MC-06 Decision Core Evolution
- MC-07 Market Expansion
- MC-08 Daily Betting Product Completion
- MC-09 Autonomous Operations
- MC-10 Final Certification

## Sport Workstreams

Each sport must eventually pass:

DATA -> PREDICTION -> PERSISTENCE -> RESULT -> SETTLEMENT -> LEARNING -> PERFORMANCE -> CERTIFICATION.

Tracked sports:

- MLB
- NBA
- NFL
- NHL
- Soccer
- Tennis
- UFC
- BSN

## Guardrails

Mission Control V1 does not:

- change prediction formulas;
- change Official Pick policy;
- change Kelly logic;
- change settlement or learning behavior;
- change scheduler cadence;
- call providers;
- mutate production data;
- start autonomous execution;
- deploy manually.

## Runtime Contract

The `/api/mission-control` response includes:

- program
- currentMission
- nextMission
- queue
- autonomousReadiness
- projectHealth
- sportReadiness
- providerReadiness
- recentCompletions
- blockers
- stopConditions
- productionVersion
- documentationVersion
- generatedAt
- evidence

The route is bounded, deterministic, read-only and safe when partial evidence fails.

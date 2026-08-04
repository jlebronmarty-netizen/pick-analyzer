# Mission Control Queue

Status: deterministic V2 queue.

MC-08 is ACTIVE only for bounded Daily Betting Product Completion work packages. Gated future missions such as MC-03 remain PLANNED and inactive.

| ID | Mission | Category | Priority | State | Mode | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| MC-00 | Mission Control Foundation | AUTOMATION | P0 | PRODUCTION_CERTIFIED | READ_ONLY | Use as the execution-state source of truth. |
| MC-01 | Operational Readiness Closure | OPERATIONAL_READINESS | P1 | PRODUCTION_CERTIFIED | AGENT_ASSISTED | Complete; use as the operational-readiness baseline before MC-02. |
| MC-02 | Multi-Sport Data Readiness | MULTI_SPORT_DATA | P1 | PRODUCTION_CERTIFIED | AGENT_ASSISTED | Complete; use sport-level readiness before MC-03 or data follow-ups. |
| MC-03 | Multi-Sport Prediction Activation | MULTI_SPORT_PREDICTION | P2 | PLANNED | MANUAL_ONLY | Wait for MC-02 and human approval. |
| MC-04 | Multi-Sport Settlement And Learning | SETTLEMENT_AND_LEARNING | P2 | PLANNED | AGENT_ASSISTED | Extend settlement only where canonical results exist. |
| MC-05 | Performance Intelligence | PERFORMANCE_INTELLIGENCE | P2 | PLANNED | AGENT_ASSISTED | Advance after eligible settled samples exist. |
| MC-06 | Decision Core Evolution | DECISION_CORE_EVOLUTION | P3 | PLANNED | MANUAL_ONLY | Use controlled experimentation only. |
| MC-07 | Market Expansion | MARKET_EXPANSION | P3 | PLANNED | AGENT_ASSISTED | Keep unsupported markets unavailable until all gates pass. |
| MC-08 | Daily Betting Product Completion | PRODUCT_EXPERIENCE | P2 | ACTIVE | AGENT_ASSISTED | Complete bounded homepage subpackages without model-policy changes. |
| MC-09 | Autonomous Operations | AUTOMATION | P2 | PLANNED | EXTERNAL_WAIT | Observe scheduler and provider evidence. |
| MC-10 | Final Certification | CERTIFICATION | P4 | PLANNED | MANUAL_ONLY | Certify after prior missions close. |

Next eligible mission after MC-02 certification: MC-08 Daily Betting Product Completion.

MC-03 remains PLANNED and manual-only. MC-03 was not started during MC-02.

## P1 Regression Queue

| ID | Work Package | State | Notes |
| --- | --- | --- | --- |
| P1.1 | Yesterday Non-Production Prediction Reconciliation | CERTIFIED | Preserved the 2026-08-02 rows as non-production historical evidence. |
| P1.2 | End-to-End System Integrity Audit | CERTIFIED | Identified the production evaluation versus recommendation-policy conflict. |
| P1.3 | Production Evaluation Policy Separation | PRODUCTION_CERTIFIED | Separates valid model output, production evaluation, recommendation eligibility, actionability and Official Pick eligibility prospectively. |
| P1.4 | End-to-End Production Pipeline Certification | PRODUCTION_CERTIFIED | Post-P1.3 protected production execution persisted 24 production-evaluable MLB rows with `feature_snapshot.productionEvaluationPolicy`. |
| P2.0 | Prediction Epoch V2 Activation | PRODUCTION_CERTIFIED | Current V2 Production activated at `2026-08-03T19:57:02.418+00:00`; historical rows preserved. |
| P2.1 | Comprehensive Supported-Market Prediction Coverage | PRODUCTION_CERTIFIED | 48/48 expected current supported MLB selections covered. |
| P2.1A | Canonical Market-Prediction Granularity Correction | PRODUCTION_CERTIFIED | 48 provider selections and 24 canonical event-market predictions certified; selection-level preview rows excluded from canonical Performance. |
| P2.2A | Performance Presentation Consistency | PRODUCTION_CERTIFIED | Clarify Current Era Performance labels without changing counts, math, settlement, learning or predictions. |
| P2.2 | New-Epoch Daily Closure Certification | PRODUCTION_CERTIFIED | P2.2D executed the protected `settle` action and certified Aug 3 Current Era closure: 24 canonical settled, 24 learning samples, 45 current-day pending, 0 silent pending. |
| P2.3 | Historical Progressive Replay V1 | PRODUCTION_CERTIFIED | Bounded replay processed 10 events / 30 replay predictions with zero provider calls and separate Replay Performance. |
| P2.4 | Next bounded Mission Control phase | READY | Next eligible phase; not started in P2.3. |

## MC-08 Work Packages

| ID | Work Package | State | Notes |
| --- | --- | --- | --- |
| MC-08A | Homepage Experience | PRODUCTION_CERTIFIED | Homepage hierarchy certified. |
| MC-08B | Rent Play Experience | PRODUCTION_CERTIFIED | Rent Play contract, unavailable-value handling and production render certified. |
| MC-08C | Moneyline Bet Experience | PRODUCTION_CERTIFIED | Moneyline contract, unavailable-value handling and production render certified. |
| MC-08D | Smart Parlay Experience | PRODUCTION_CERTIFIED | Smart Parlay contract, selection, combined-odds and no-joint-probability behavior certified. |
| MC-08E | Watchlist Experience | PAUSED | Paused work remains preserved in the main checkout; do not resume until the P1/P2 sequence allows MC-08E-R. |

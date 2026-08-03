# P1.2 E2E System Integrity Audit

## Verdict

`CONDITIONAL_PASS_POLICY_DECISION_REQUIRED`

The canonical pipeline is observable and now has a protected read-only integrity endpoint. The major product surfaces are expected to derive from stored prediction evidence through Current Board, Dashboard Today and Performance scope contracts. P1.2 found no reason to rewrite historical rows or settle non-production rows.

The remaining blocker is a policy decision: whether production evaluation should include every valid pregame prediction or only rows that pass the current production/recommendation gates.

## Current Finding

P1.1 classification remains authoritative for `2026-08-02`:

- Generated rows: `45`
- Valid pregame rows: `45`
- Production eligible rows: `0`
- Production settled rows: `0`
- Events without valid production prediction: `15`
- Exact classification: `PREGAME_VALID_QUARANTINED_PREVIEW`

Do not retroactively promote those rows.

## Prediction Engines Found

- `sport-prediction-engine-sdk.service.ts`: shared prediction construction.
- `sportsdataio-mlb-prospective-preview.service.ts`: MLB prospective preview and stored prediction generation.
- `mlb-prediction-engine.service.ts`: MLB prediction preview/validation.
- `nba-prediction-engine.service.ts`, `nfl-prediction-engine.service.ts`, `nhl-prediction-engine.service.ts`, `soccer-prediction-engine.service.ts`, `tennis-prediction-engine.service.ts`, `ufc-prediction-engine.service.ts`: sport-specific engines.
- Historical, replay, shadow and backtest paths remain present and must remain separate from production.

## Surface Reconciliation

Current Board, Dashboard Today, Most Likely, Best Value, AI Bet Finder, Betting Workbench, Performance and Mission Control are treated as specialized views over stored canonical evidence. The protected `/api/operations/e2e-integrity` route reports the current surface source map and live bounded counts.

## Market Coverage Rule

For supported MLB markets:

AVAILABLE + NORMALIZED + SUPPORTED + DATA-SUFFICIENT + BEFORE CUTOFF = PREDICTION REQUIRED

Minimum audited supported selections:

| Market | Expected selections |
| --- | --- |
| Moneyline | home, away |
| Spread / Run Line | home, away |
| Total | over, under |

Unsupported or uncertified markets remain excluded unless the full chain exists: normalization, feature inputs, prediction logic, cutoff, persistence, settlement and Performance.

## Missed Opportunities

P1.2 distinguishes:

- `MISSED_PREDICTION`: no valid pregame prediction row exists when one was required.
- `QUARANTINED_VALID_PREDICTION`: a valid pregame model row exists but is not production eligible.
- `UNSUPPORTED_MARKET`: market is visible somewhere but not certified end to end.
- `NO_ODDS`: supported market lacks usable odds.
- `NO_FEATURES`: feature inputs are insufficient.
- `PROVIDER_BLOCKED`: provider evidence is unavailable or blocked.
- `CUTOFF_MISSED`: prediction would require post-cutoff generation.

For `2026-08-02`, the 15 MLB events are both valid non-production prediction events and missed production opportunities under different definitions.

## Result, Settlement, Learning And Performance

Closure identity remains:

production-eligible completed predictions = settled + blocked + explicit pending

Non-production rows must not be settled as production. Performance must continue to expose generated rows separately from production-evaluable rows.

## Prediction Epoch V2 Activation Roadmap

1. Resolve the production evaluation policy decision.
2. Add or prove additive epoch metadata support:
   - `epochId`
   - `epochName`
   - `epochStartedAt`
   - `certifiedBaselineCommit`
   - `engineVersion`
   - `featureVersion`
   - `policyVersion`
   - `productionScopeVersion`
   - `timezone`
   - `status`
3. Define scopes:
   - `CURRENT_V2_PRODUCTION`
   - `LEGACY_PRE_V2`
   - `BACKTEST`
   - `REPLAY`
   - `SHADOW`
4. Start only on a future operating-day boundary after deployment.
5. Keep historical rows immutable.

Recommended boundary: first future MLB operating day after policy approval and deployment. Do not backdate to `2026-08-02`.

## Comprehensive Supported-Market Coverage Roadmap

1. Use `/api/operations/e2e-integrity` to report current supported selection coverage.
2. For every current event and supported market, report predicted vs missing selections.
3. Convert every missing selection into one explicit reason.
4. Add durable missed-opportunity persistence only after the contract is approved.
5. Do not add or expose unsupported markets as recommendations.

## Historical Progressive Replay Roadmap

Readiness is `PARTIAL`.

Required before broad replay:

1. Chronological event ordering.
2. Pre-cutoff odds snapshot selection.
3. Pre-event feature snapshot selection.
4. Frozen engine/version.
5. Replay-only prediction persistence.
6. Authoritative result attachment.
7. Replay-only settlement and cumulative Performance.
8. Idempotent checkpointing.
9. Strict separation from production rows.

Historical replay was not started in P1.2.

## Repairs Made

- Added protected read-only E2E integrity diagnostics.
- Added P1.2 validation and certification artifacts.

No prediction, Official Pick, Kelly, ranking, settlement, learning, provider budget, scheduler cadence or refresh cadence behavior was changed.

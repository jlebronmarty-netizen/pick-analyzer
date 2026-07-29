# Historical Settled Status Reconciliation V1

Date: 2026-07-28

Status: `LOCAL_CERTIFIED_QUERY_REPAIR`

## Scope

Targeted P1 consistency repair for divergence between raw historically stored settled status and deterministic result-based settled counts. This phase was read-only for data: no settlement rows, game results, learning labels, model weights, probabilities, confidence, Trust values, Official Pick policy, epochs or provider data were changed.

## Competing Definitions

`stored terminal`
: `prediction_history.result` or `prediction_history.status` is `win`, `loss`, `push` or `void`, unless Settlement Reconciliation V2 lifecycle metadata marks the row as Legacy, Historical, Replay, Shadow, Ignored, Unknown, Cancelled or Voided.

`deterministic terminal`
: a canonical `game_results` row exists for `prediction_history.game_id`, has complete scores, the market is supported, the prediction selection can be matched to the canonical teams, and the settlement primitive can calculate `win`, `loss`, `push` or `void`.

`Performance included`
: cutoff-safe, non-fixture, non-audit-lifecycle rows with terminal Win/Loss/Push evidence according to the canonical settlement-state classifier.

`learning included`
: Performance-included rows that also have immutable feature evidence.

`scheduler settled`
: rows that the canonical stored-outcome classifier says are already terminal; pending rows require canonical `game_results` evidence before becoming settlement-ready.

## Canonical Contract

A row counts as settled for product performance only when:

- it has a persisted terminal settlement state;
- the terminal outcome is compatible with the supported market;
- it has authoritative canonical `game_results` evidence or an explicit supported legacy lifecycle;
- no deterministic result conflict is present;
- duplicate, Preview, Shadow, Historical, Replay, Ignored, invalid-cutoff and unsupported rows are excluded from production Performance and learning views unless a consumer explicitly asks for audit scope.

Stored status alone is not authoritative for product Performance. Deterministic result alone is not authoritative for production Performance if the row is invalid-cutoff, Preview, Shadow, legacy/audit-only or otherwise lifecycle-excluded. For current product surfaces, both lifecycle inclusion and outcome evidence must agree.

## Row-Level Audit

Read-only audit source: `docs/historical-settled-status-reconciliation-v1.json`.

Overall:

| Metric | Count |
| --- | ---: |
| prediction rows scanned | 2,595 |
| unique prediction game IDs | 671 |
| canonical game_results rows read | 423 |
| stored terminal rows | 983 |
| deterministic terminal rows | 1,063 |
| Performance-included rows | 386 |
| learning-included rows | 354 |
| scheduler already-settled rows | 983 |
| pending rows | 1,082 |
| awaiting-result rows | 1,082 |

MLB:

| Metric | Count |
| --- | ---: |
| rows | 1,194 |
| stored terminal rows | 956 |
| deterministic terminal rows | 1,063 |
| Performance-included rows | 386 |
| learning-included rows | 354 |
| pending rows | 48 |
| awaiting-result rows | 48 |

Classification matrix:

| Classification | All Sports | MLB |
| --- | ---: | ---: |
| `STORED_SETTLED_AND_DETERMINISTIC_SETTLED` | 380 | 380 |
| `STORED_SETTLED_RESULT_CONFLICT` | 6 | 6 |
| `STORED_PENDING_CANONICAL_RESULT_MISSING` | 48 | 48 |
| `INVALID_CUTOFF_ROW` | 525 | 525 |
| `LEGACY_SETTLEMENT_REPRESENTATION` | 530 | 190 |
| `SHADOW_ROW` | 1,106 | 45 |

Sport matrix:

| Sport | Rows | Main Classification |
| --- | ---: | --- |
| MLB | 1,194 | Production plus invalid-cutoff/audit rows |
| NFL | 966 | 776 Preview, 190 legacy/audit |
| NHL | 258 | 258 Preview |
| NCAAF | 122 | Legacy/audit |
| NBA | 27 | Shadow |
| BSN | 8 | Invalid-cutoff |
| EPL | 20 | Legacy/audit |

## Root Causes

- `LEGACY_STATUS_ENCODING`: older rows store `status`/`result` patterns that are not enough for modern product inclusion.
- `LEGACY_OUTCOME_ENCODING`: valid audit/legacy rows may carry terminal-looking states but remain excluded from production Performance.
- `MISSING_CANONICAL_GAME_RESULT`: 48 MLB pending rows remain unresolved because canonical `game_results` evidence is absent.
- `OUTCOME_PRESENT_STATUS_PENDING`: legacy rows can carry pending-ish statuses while lifecycle metadata governs audit exclusion.
- `PREVIEW_INCLUDED_IN_COUNT`: NFL/NHL Preview rows are genuine but excluded from Production Performance.
- `SHADOW_INCLUDED_IN_COUNT`: shadow rows are genuine but not Production Performance or learning evidence.
- `PERFORMANCE_FILTER_MISMATCH`: some consumers historically counted raw terminal/deterministic rows instead of lifecycle-safe production rows.
- `LEARNING_FILTER_MISMATCH`: learning evidence now delegates to the same canonical production-settled predicate.
- `SCHEDULER_FILTER_MISMATCH`: scheduler pending detection now delegates to the same canonical stored-outcome predicate.

## Repair

Added `src/services/canonical-settlement-state.service.ts` as the shared read-only classifier for:

- stored outcome;
- deterministic canonical outcome;
- lifecycle badge;
- pending reason;
- Performance inclusion;
- learning inclusion;
- scheduler already-settled/pending state;
- row-level divergence classification.

Updated consumers:

- `src/services/performance-scope-v2.service.ts`
- `src/services/ai-learning-lifecycle.service.ts`
- `src/services/adaptive-refresh-orchestrator.service.ts`

No data repair was executed. The six stored/deterministic conflicts are classified for a future bounded row-level repair gate; they were not rewritten because the prompt forbids broad historical rewrite and requires exact provenance before mutation.

## Validation

- Focused reconciliation validator: `25/25`.
- Read-only row audit: passed, 0 provider calls, 0 remote mutations, 0 settlement writes, 0 learning writes, 0 model-weight mutations.
- NFL Preview non-regression: 776 rows.
- NHL Preview non-regression: 258 rows.

## Certifications

- `HISTORICAL_SETTLED_STATUS_RECONCILIATION_PASS`
- `CANONICAL_SETTLEMENT_STATE_CONTRACT_PASS`
- `PERFORMANCE_SETTLEMENT_COUNT_PARITY_PASS`
- `LEARNING_SETTLEMENT_COUNT_PARITY_PASS`
- `SCHEDULER_SETTLEMENT_COUNT_PARITY_PASS`
- `LEGACY_SETTLEMENT_COMPATIBILITY_PASS`
- `NO_FORCED_SETTLEMENT_PASS`
- `NO_RESULT_FABRICATION_PASS`
- `NO_PROBABILITY_CHANGE_PASS`
- `NO_CONFIDENCE_CHANGE_PASS`
- `NO_TRUST_FORMULA_CHANGE_PASS`
- `NO_OFFICIAL_PICK_POLICY_CHANGE_PASS`
- `NO_MODEL_WEIGHT_MUTATION_PASS`
- `NFL_PREVIEW_NON_REGRESSION_PASS`
- `NHL_PREVIEW_NON_REGRESSION_PASS`

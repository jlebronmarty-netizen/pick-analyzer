# ODDS-03C-R Re-Prediction Proof

## Verdict

`ODDS_PRIMARY_PROMOTION_BLOCKED`

ODDS-03C-R used naturally captured production evidence from commit
`5050662c3e3f95d845b07f59d33ce13d36963725`.

The Odds API dual-read path is healthy as a shadow acquisition path, but the
line-versioned re-prediction mechanism is not wired as a production writer. The
current repository contract remains `DRY_RUN_ONLY` with
`requiresExplicitWriter = true`.

## Runtime State

| Area | Evidence |
| --- | --- |
| Production commit | `5050662c3e3f95d845b07f59d33ce13d36963725` |
| Odds authority stage | `STAGE_1_DUAL_READ` |
| Product odds authority | `SPORTSDATAIO` |
| The Odds API status | `SHADOW_NON_AUTHORITATIVE` |
| MLB data source mode | `DUAL_READ` |
| Provider calls from certification reads | `0` |
| Database mutations from certification reads | `0` |

## Natural Moved-Line Cases

Certification reconstructed five naturally observed moved Total candidate rows
from stored production evidence. The original ODDS-03C window had four moved
Total rows; one additional moved row appeared in the later natural shadow
window.

| Event | Prediction | Selection | Old Line | Current Line | Move | Eligibility |
| --- | --- | --- | ---: | ---: | --- | --- |
| TEX @ LAA | `81060b68-6fba-531b-9aca-e6dc799c677f` | Under | 8.5 | 8.0 | HALF_POINT_MOVE DOWN | ELIGIBLE_FOR_NEW_LINE_PREDICTION |
| MIL @ SD | `8ecfaf20-c211-582d-9f96-48d6444dc4c0` | Under | 7.5 | 7.0 | HALF_POINT_MOVE DOWN | ELIGIBLE_FOR_NEW_LINE_PREDICTION |
| TEX @ LAA | `d55162d9-5f6d-53c5-b49e-d91bfee15470` | Over | 8.5 | 8.0 | HALF_POINT_MOVE DOWN | ELIGIBLE_FOR_NEW_LINE_PREDICTION |
| MIL @ SD | `399e800d-2558-5099-b8c9-0038b60803e4` | Over | 7.5 | 7.0 | HALF_POINT_MOVE DOWN | ELIGIBLE_FOR_NEW_LINE_PREDICTION |
| TB @ ATH | `cb30e8f1-040f-5934-81b8-944941da4a22` | Under | 9.5 | 10.0 | HALF_POINT_MOVE UP | ALREADY_EXISTS |

All reconstructed moved-line cases were pregame, before cutoff, supported
Total markets, and backed by fresh The Odds API shadow evidence from certified
books.

## Dry-Run Result

The production code path `buildLineVersionedRepredictionPlan` was executed in
dry-run/non-persistent mode against the naturally captured rows.

| Result | Count |
| --- | ---: |
| Eligible for new-line prediction | 4 |
| Cutoff blocked | 0 |
| Feature blocked | 0 |
| Already existing exact-line prediction | 1 |
| Production prediction writes | 0 |

The dry-run lineage contract produced:

- `executionMode = EXECUTABLE_GATED`
- `productionPredictionCreated = false`
- `requiresExplicitWriter = true`
- `supersedeReason = MARKET_LINE_CHANGED`
- unique dedupe keys by `eventId + market + selection + line`

## Natural Execution Wiring

`src/services/adaptive-refresh-orchestrator.service.ts` executes:

1. SportsDataIO canonical acquisition.
2. SportsDataIO stored-odds prediction generation.
3. The Odds API shadow dual-read acquisition.
4. MLB Official shadow acquisition.

No natural Stage 1 step invokes a line-versioned prediction writer after The
Odds API shadow acquisition. The codebase also contains an existing validator
asserting that re-prediction remains dry-run only.

Classification:

`NATURAL_EXECUTION_WIRING_DEFECT`

This is not a Stage 1 shadow isolation defect. Stage 1 correctly avoids using
The Odds API as product price authority. The promotion blocker is that there is
no production writer ready to create cutoff-safe new-line prediction rows once
The Odds API becomes authority.

## Safety

Cross-line safety passed:

- old Total 8.5 probabilities were not bound to Total 8.0 odds;
- old Total 7.5 probabilities were not bound to Total 7.0 odds;
- stale or unavailable exact-line prices remained non-actionable;
- missing current-line predictions fail closed as
  `WAITING_FOR_CURRENT_LINE_PREDICTION` / `NO_ALIGNED_PRICE`;
- settlement remains line-specific by prediction line;
- recommendation exposure remains separate from prediction evidence.

## Operations Health

Production `/api/operations/health` reported `CRITICAL` with blocker
`odds_not_current`.

Classification:

`UNRELATED_OPERATIONAL_HEALTH_SIGNAL_FOR_SCHEDULER`

The scheduler and shadow acquisition path are functioning. The critical signal
is driven by the current SportsDataIO product odds freshness contract while The
Odds API remains non-authoritative. This is promotion-relevant evidence, but it
does not by itself prove the re-prediction writer is ready.

## Promotion Gate

Promotion is blocked until a bounded runtime phase adds and certifies the
explicit line-versioned prediction writer:

fresh current line -> exact-line prediction exists -> evaluate value

or

fresh current line -> exact-line prediction missing -> generate cutoff-safe
new-line prediction with lineage

or

cannot generate -> fail closed as `WAITING_FOR_CURRENT_LINE_PREDICTION`

Never allowed:

fresh new-line odds + old-line probability.


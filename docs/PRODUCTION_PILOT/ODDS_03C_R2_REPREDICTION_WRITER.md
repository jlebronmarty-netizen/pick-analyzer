# ODDS-03C-R2 Re-Prediction Writer

## Verdict

`REPREDICTION_WRITER_READY_FOR_DEPLOYMENT`

ODDS-03C-R2 implements the missing line-versioned re-prediction writer while
leaving odds authority unchanged.

## Scope

The writer handles this certified gap:

fresh current sportsbook line changes
-> exact new line detected
-> cutoff-safe plan
-> prediction engine evaluates the new exact line
-> versioned prediction row can be persisted when the authority stage allows it

No provider authority promotion was performed.

## Canonical Writer Reuse

The implementation reuses the existing production prediction engine:

- `buildSportPrediction`
- `evaluateRecommendationEligibility`
- `evaluatePredictionEvaluationPolicy`
- existing `prediction_history` row contract
- existing version fields and lineage fields

It does not introduce a separate probability engine or line interpolation
model.

## Stage Behavior

| Stage | Behavior |
| --- | --- |
| `STAGE_1_DUAL_READ` | `NON_PERSISTENT_SHADOW_EXECUTION`; would-write evidence only |
| `STAGE_2_THE_ODDS_API_PRIMARY_INTERNAL` | Non-product/internal until separately promoted |
| `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT` | Persistent writer can create exact-line rows |
| `STAGE_4_SPORTSDATAIO_ODDS_DISABLED_ROLLBACK_AVAILABLE` | Persistent writer can create exact-line rows with rollback retained |

Current deployment remains `STAGE_1_DUAL_READ`, so natural execution produces
no production prediction writes.

## Safety Gates

The writer rechecks immediately before persistence:

- event is still pregame;
- current time is before cutoff;
- market is supported;
- fresh current source evidence exists;
- source timestamp is not future-dated;
- pregame feature context is available;
- projected line context is available;
- exact new-line prediction does not already exist;
- no post-start prediction fabrication occurs.

## New-Line Probability Generation

The writer never reuses old-line probability for new-line odds.

For a Total line move, it derives the underlying projected total from the prior
prediction margin and old line, then re-evaluates the new line through
`buildSportPrediction`.

Example:

`Over 8.5` and `Over 8.0` are separate model inputs and separate persisted
identities.

## Lineage

When persistence is enabled by a future authority stage:

- original prediction is preserved;
- new row receives a deterministic ID and idempotency key;
- new row points to `parent_prediction_id`;
- old row receives `superseded_by_prediction_id`;
- lineage reason is `MARKET_LINE_CHANGED`.

## Deduplication

The idempotency identity is:

`event + market + selection + line`

Repeated scheduler passes for the same current line return `ALREADY_EXISTS`.
Concurrent duplicate writes converge on one deterministic row ID.

## Return-To-Prior-Line Policy

Policy:

`CREATE_NEW_VERSION_IF_FEATURE_OR_TIME_CONTEXT_CHANGED`

The system does not blindly reactivate an older prediction when the market line
returns to a prior value.

## Product Exposure

New line-versioned rows are prediction evidence first. They do not
automatically become:

- Official Picks;
- Rent Play;
- Smart Parlay legs;
- recommendation performance.

Existing product policies decide exposure.

## Settlement And Learning

Every line version settles against its own line. Learning remains governed by
existing eligibility and dedupe rules. No learning weights changed.

## Natural Evidence Replay

ODDS-03C-R certified five naturally captured moved-line cases:

| Count | Result |
| --- | ---: |
| Natural moved-line cases exercised | 5 |
| Would create | 4 |
| Would dedupe | 1 |
| Would block | 0 |

Stage 1 certification mutations:

- provider calls: `0`;
- production database mutations: `0`;
- production prediction writes: `0`.

## Promotion Readiness

The writer is ready to deploy. Odds-primary promotion remains a separate human
authorization gate.

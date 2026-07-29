# Training Expansion Roadmap

Date: 2026-07-29

Status: READ-ONLY ROADMAP

## Target

Current accepted rows: 354. First controlled candidate-training gate: 1,000. Required net increase: 646 accepted rows.

## Stage A: Recover Missing Canonical Evidence

Action: repair canonical result and provider mapping gaps using stored metadata only before considering any imports.

- Certified training-ready rows after stage: 354
- Maximum review pool after stage: 950
- Note: Stage A alone does not certify rows missing feature snapshots or model versions.

## Stage B: Recover Feature Completeness

Action: link existing feature snapshots and model-version metadata where point-in-time evidence already exists.

- Certified training-ready rows after stage if all 596 recoverable rows pass: 950
- Remaining rows to 1,000: 50
- Note: this is the highest-value no-import path.

## Stage C: Recover Historical Predictions

Action: future design gate for approved historical prediction reconstruction. No replay is authorized by this phase.

- Certified training-ready rows after stage without future approval: 950
- Maximum review pool including preview/shadow rows: 2,586
- Note: the 1,636 preview/shadow rows are partially recoverable only after legitimate settlement, production eligibility and contract review.

## Stage D: Historical Imports

Action: future approval gate for historical provider/archive acquisition, feature rebuild and replay.

- Certified training-ready rows after stage in this phase: 950
- Maximum review pool remains 2,586 from current stored evidence.
- Note: no provider calls, imports or feature rebuilds are authorized here.

## Stage E: Candidate Training

Action: eligible only after accepted rows exceed 1,000 and all governance gates pass.

- Current status: blocked
- Expected unlock path: Stage B plus at least 50 new normal production accepted rows, or normal production operation reaching the threshold directly.

## Next Safe Action

Run a read-only row-level recovery audit for the 596 `BLOCKED_MISSING_EVIDENCE` rows to determine how many have existing feature snapshots, model versions and canonical result evidence that can be linked without imports.

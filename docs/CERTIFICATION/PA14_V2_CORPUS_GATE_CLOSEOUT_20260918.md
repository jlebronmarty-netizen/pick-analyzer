# PA-14 V2 — Historical Corpus Gate Closeout

Date: 2026-09-18

Status: `HISTORICAL_PATH_CERTIFIED_BUT_CORPUS_TOO_SMALL_AND_TEMPORALLY_UNEVEN_FOR_TRAINING`

## Frozen boundary

- contract: `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0`
- builder: `697ead7e1d596aa3aeee50fbeafe45424735af5ca32f58c5786a4965064a0fc3`
- MLB Official type-repair source is certified under PR #45
- V1 remains terminal and cannot be relabeled as V2

## Independent evidence

### Balanced sample 1

- rows: **72**
- eligible: **20**
- yield: **27.78%**
- Apr 8 / May 5 / Jun 2 / Jul 1 / Aug 3 / Sep 1

### Balanced sample 2

Independent games from sample 1:

- rows: **72**
- eligible: **14**
- yield: **19.44%**
- Apr 5 / May 4 / Jun 3 / Jul 2 / Aug 0 / Sep 0

Combined balanced evidence:

- **34 / 144 = 23.61%**

### September directed gate

Forty additional September starter-targets were audited after the same frozen repair policy:

- rows: **40**
- eligible: **3**
- yield: **7.50%**
- `INCOMPLETE_PA` occurred on **26 / 40**
- `MISSING_VELOCITY` occurred on **13 / 40**

This does not mean September is impossible, but it establishes materially weaker late-season yield under the frozen V2 contract.

## Canonical stored census — final

- total rows: **38**
- unique identities: **38**
- replay PASS: **38**
- certification candidates: **38**
- production eligible: **0**
- shadow only: **38**
- historical 2025: **37**
- forward/source-certification 2026: **1**

2025 stored distribution:

- Apr 13
- May 9
- Jun 5
- Jul 3
- Aug 3
- Sep 4

All three September-gate ELIGIBLE rows were subsequently stored and replayed successfully with zero network calls during replay. Across the final three materialization batches, **19 / 19** requested rows passed stored replay and all remained shadow-only / production-ineligible.

## Decision

`PE_PITCHER_K_V2_TRAINING_AUTHORIZED = NO`

`PE_PITCHER_K_V2_MODEL_STATUS = NOT_STARTED`

The source/materialization path is proven, but the current corpus is too small and too uneven across the season to justify a new fitted model, holdout, and independent calibration.

## Reopen condition

N3.4d may reopen only after one of these occurs:

1. a materially larger replay-PASS corpus with meaningful late-season representation accumulates under the same frozen V2 contract; or
2. a separately versioned future contract is proposed and explicitly gated as new research.

Do not relax or retune `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0` to increase yield.

## Safety

- Official Picks unchanged
- APOSTAR inactive
- no production promotion
- no historical Odds API credit use
- no V1-as-V2 relabeling

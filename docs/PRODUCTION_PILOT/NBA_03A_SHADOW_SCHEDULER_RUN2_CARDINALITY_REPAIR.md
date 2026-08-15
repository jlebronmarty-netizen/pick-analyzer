# NBA-03A Shadow Scheduler Run 2 Cardinality Repair

Status: `NBA_03A_SHADOW_SCHEDULER_RUN2_CARDINALITY_REPAIR_CERTIFIED_READY_FOR_PUBLICATION`

## Root Cause

Natural Run 2 selected three bounded candidates, then invoked the certified
single-candidate writer once per candidate key. The writer revalidated each key
against a freshly reconstructed candidate universe.

The cardinality guard was too narrow: it searched only `writeEligible`
candidates. An exact candidate key that had become idempotently present as
`ALREADY_EXISTS` no longer counted as one selected candidate, so the writer
reported `WRITE_CARDINALITY_NOT_ONE` instead of `ALREADY_EXISTS`.

## Repair

`write-one` still requires exactly one explicit candidate key. It still rejects
zero matches and multiple matches as `WRITE_CARDINALITY_NOT_ONE`.

The allowed idempotent case is now explicit:

- one exact candidate key match;
- candidate has `ALREADY_EXISTS`;
- writer returns `ALREADY_EXISTS`;
- scheduler counts that as selected-candidate reuse, not a new insert.

No unsafe bulk writer was added. The scheduler still loops over at most three
selected candidate keys and calls certified `write-one` semantics independently.

## Partial Failure

Scheduler writes are row-level and idempotent, not destructive transactions.

If candidate A succeeds, candidate B fails, and candidate C is not completed,
the successful prior write remains. The run is classified
`PERSISTENCE_FAILURE_BLOCKED`, the failed candidate is reported separately, and
failed runs do not increment completed canary runs. A rerun is safe because
created rows become `ALREADY_EXISTS`.

## Audit Accounting

New audit rows include:

- selected candidate keys;
- persistence attempts;
- per-candidate write status;
- inserted count;
- selected-candidate reuse count;
- failure classification.

Existing historical audit rows were not rewritten. Failed production job
`4dc3c613-b53b-45c4-b52f-146ec97a7e9c` stored selected count but did not store
the exact selected candidate keys.

## Safety

Provider budget semantics are unchanged:

- The Odds API: max 2 calls per run;
- SportsDataIO: 0;
- historical odds: 0;
- bounded unknown-balance canary authorization preserved.

No certification provider calls, production database mutations, manual
scheduler invocations, production shadow writes, Official Picks, product
visibility, learning, calibration, bankroll, notifications, Historical Replay,
settlement, or MLB changes were performed by this repair.

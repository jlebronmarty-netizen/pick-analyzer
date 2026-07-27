# MLB Event And Result Completion V3

Status: local reconciliation contract prepared; production result completion requires separately approved import execution.

This phase does not call providers, import rows, mutate production data, generate retrospective predictions, seed epochs, link legacy predictions or rebuild features.

## Stored State

From Phase A1:

- MLB events/schedule rows: 4922
- Completed event rows: 4012
- Stored result rows: 471
- Future scheduled rows: 847

This is not complete result coverage. The safe local outcome for this phase is a deterministic reconciliation and import contract, not a claim that all missing results are filled.

## Event Identity Contract

Canonical MLB event identity must use:

- sport key: `baseball_mlb`
- season
- scheduled UTC start time
- home canonical team ID
- away canonical team ID
- provider event ID when available
- doubleheader discriminator when two same-team games share a local date
- postponed/rescheduled lineage when status changes

Natural key:

`baseball_mlb:{season}:{local_date}:{away_team_id}:{home_team_id}:{game_number_or_provider_id}`

Rules:

- Team/date-only matching is never enough for mutation.
- Same teams on same local date require provider ID or explicit doubleheader discriminator.
- Rescheduled games preserve lineage and must not create a second canonical event unless the original event identity is provably different.
- Final score must be tied to the canonical event ID before settlement use.

## Result Completion Contract

Required final-result fields:

- canonical event ID
- source provider
- provider event ID
- final status
- home final score
- away final score
- final observed timestamp
- source timestamp
- ingestion timestamp
- overtime or extra-innings indicator where available
- postponement/cancellation status where applicable
- deterministic result idempotency key

Result idempotency key:

`mlb_result:{provider}:{provider_event_id}:{final_status}:{home_score}:{away_score}`

## Doubleheader Safety

Doubleheader detection requires at least one of:

- explicit provider game number
- distinct provider event IDs with same teams/date
- distinct UTC start times with stable canonical event IDs
- official Retrosheet doubleheader evidence where supported

Blocked cases:

- same teams/date with missing provider IDs
- swapped home/away evidence conflict
- one final score and two candidate canonical events
- postponed game reappearing with ambiguous original identity

## Local Reconciliation Findings

The stored state supports:

- deterministic event ID planning
- current and future schedule inventory
- partial final-result coverage
- provider-mapping based reconciliation
- no duplicate-generation requirement for already stored rows

The stored state does not support claiming full previous/current season result completion because stored results are partial.

## Import Execution Plan

Execution remains blocked until approved.

Plan:

1. Read missing completed MLB events with no `game_results` row.
2. Group by local date.
3. Dry-run at most 3 current-season dates or 7 historical dates per review.
4. Resolve provider event ID or Retrosheet event identity.
5. Reject ambiguous doubleheaders.
6. Upsert final results by deterministic key only after approval.
7. Postcheck event/result count, duplicate result keys and settlement eligibility.

## Idempotency Checks

A future import must prove:

- repeated dry-run returns identical candidate count
- repeated write after approval inserts 0 new rows
- no existing result row is overwritten with conflicting score
- no prediction row is generated or modified
- no settlement row is rewritten
- no feature snapshot is rebuilt

## Certification

- `MLB_EVENT_RESULT_COMPLETION_V3_READY_FOR_IMPORT`
- `MLB_DOUBLEHEADER_RECONCILIATION_PASS`
- `MLB_IMPORT_IDEMPOTENCY_V3_PASS`
- Provider calls: 0
- Remote mutations: 0
- Production mutations: 0
- Retrospective predictions generated: 0

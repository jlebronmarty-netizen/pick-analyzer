# MLB R6 Historical FAILED Run Closeout — 2026-09-19

Status: `RESOLVED / EVIDENCE PRESERVED`

## Incident

The production endpoint `/api/cron/mlb-operational` had been returning HTTP 503 every 15 minutes.

Seven historical RUN rows existed with `status=FAILED`.

A first-pass diagnosis attributed the 503 to all seven rows being counted as pending. Current production state showed a more precise cause:

- six FAILED rows were already explicitly terminalized as `TERMINAL_PARTIAL_PRESERVED`;
- Supabase Edge Function `mlb-runtime-state` v14 already excludes those six from its `PENDING` predicate;
- one Sep13 FAILED run remained without terminal disposition and was therefore still a legitimate pending/review blocker.

The unresolved run was:

`automation-884fdb346cfc5de32eae2b9b7362f6a24e8cd93e76abde08b770841b3d74aa39`

## Safety review before disposition

The Sep13 run was verified as:

- status: `FAILED`
- run date: `2026-09-13`
- failure: `DEPENDENCY_READ_FAILURE`
- failure stage: `SCOPE`
- scoped games: 14
- expired scoped games at review: 14/14
- prediction rows at the frozen `run_as_of`: 0
- business DML stages: 0
- Odds calls: 0
- Statcast calls: 0
- MLB Official calls: 1
- active lease: none

No historical row was deleted.

## Disposition

A single fail-closed transaction locked both the global lease row and target RUN row and required exact identity/revision/checkpoint/accounting/readback conditions before writing.

Result:

- status remains `FAILED`
- revision: 4 -> 5
- checkpoint stage: `TERMINAL_PARTIAL_PRESERVED`
- original failure `DEPENDENCY_READ_FAILURE` preserved
- disposition reason: `EXPIRED_FREEZE_NO_RETROACTIVE_MARKETS`
- prediction count: 0
- readback: `PASS`
- reviewed at: `2026-09-19T14:51:08.247Z`
- review digest: `dcae45cdde5c9cb3a41b3b286c8edfdb574f77f7b4c3a9029c6e85b521d5ba9a`

Post-disposition census:

- FAILED RUN rows: 7
- FAILED + `TERMINAL_PARTIAL_PRESERVED`: 7
- authority pending RUNs: 0
- active RUN leases: 0

## Boundaries

- no deletion
- no Official Picks mutation
- no APOSTAR activation
- no business-table DML
- no synthetic recovery
- no retroactive market reconstruction

The next scheduled `mlb-operational` invocation is the production proof that the historical-run blocker is gone. Any later 503 must be investigated as a new, independent failure rather than attributed to the seven historical FAILED rows.

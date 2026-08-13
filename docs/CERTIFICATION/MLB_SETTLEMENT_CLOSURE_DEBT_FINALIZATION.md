# MLB Settlement Closure Debt Finalization

Status: `MLB_SETTLEMENT_CLOSURE_DEBT_RUNTIME_REPAIR_READY_FOR_DEPLOYMENT`

Production at `da91fc66c4dce49c2f94c653ed7a3c464c141dd4` still reports Settlement Guarantee `ACTION_REQUIRED`: 6 settlement-ready rows, 5 explicitly blocked rows and 0 silent pending rows. The six ready rows already have deterministic canonical final result evidence.

Root cause: the protected operating-day settlement writer returned only `operating_day_id` linked predictions when any linked row existed. That skipped same-local-date predictions with final results. A prior protected settlement attempt therefore checked only one unresolved prediction and left the six ready rows untouched.

Repair: `src/services/operating-day.service.ts` now merges linked and same-local-date predictions, dedupes by prediction id, and rechecks cutoff/start safety before settlement. The dry-run after repair found 6 eligible rows, 3 wins, 3 losses, 0 pushes, 3 post-start rows blocked and 21 rows still missing authoritative final result evidence.

No prediction formulas, probabilities, candidate selection, ranking, Official Pick policy, market authority, scheduler architecture, settlement math, learning weights or NBA historical foundation changed. The repair adds 0 provider calls.

Post-deploy requirement: publish the repair, rerun protected settlement for `2026-08-13`, then re-read Settlement Guarantee and Operations Health.

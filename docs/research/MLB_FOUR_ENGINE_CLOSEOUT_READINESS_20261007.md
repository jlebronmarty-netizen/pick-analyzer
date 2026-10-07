# MLB four-engine closeout readiness — 2026-10-07

RESEARCH/SHADOW ONLY. Authoritative after PRs Pick #268, Edge #80, Equilizer #35 and Pulpy #20.
This supersedes the Oct7 pre-import Edge status. PR #267 is closed as superseded; evidence and branches remain preserved.

| Engine | Archive decision | Verified record | What prevents final seasonal shutdown |
| --- | --- | --- | --- |
| Pick Analyzer | PREPARED; postseason still active | Contracts remain independent; 686 master rows | 74 OPEN Pick rows, exact-outcome blockers and remaining playoffs |
| Pick Edge | REGULAR_FORWARD_SETTLEMENT_COMPLETE | 75 =42 WIN/31 LOSS/2 VOID/0 OPEN;57.53% scored | Final playoff capture inventory and explicit seasonal schedule pause |
| Equilizer | ORIGINAL_COHORT_CLOSED_TRUNCATED |130/150;77 WIN/53 LOSS;59.23%;0 OPEN | Nothing to complete in original cohort; final evaluator still locked |
| Pulpy | ARCHIVE_READY_NOT_META_CERTIFIED |58 tests PASS; no eligible playoff pregame bundle observed | Remaining outcome inventory and explicit final schedule pause |

## Source repairs completed
HOME +1.5: two WIN rows backed by two distinct persisted settlement jobs. Idempotent recovery repeated; zero duplicates.
Normal sync now has the source evidence it requires, instead of transient manual ledger-only repairs.
Exact original freezes, quotes, dates, teams and gamePk remain intact.
Edge Sep22: original CSV SHA46e3711013617449b17d1ad47c2a6ce51f879db0aa91bbf9dbf5ba47ae4e232f.
Settlement artifact persisted in merged Edge #80 and imported into master/audit, with same-freeze verification.
One exact original-date postponed row is VOID; later-date final scores are not substituted.
Edge summary now42/73=57.53%,2 VOID; ROI/EV/CLV remain NULL.

## Open evidence inventory
Pick OPEN:44 regular-season (42 Doubles U0.5,2 Walks U0.5),30 postseason (29 Doubles U0.5,1 K O3.5).
50 existing approved-prop settlement rows explicitly report EXACT_OUTCOME_NOT_AVAILABLE;24 newer open rows include23 Doubles and1 K on Oct6.
Do not infer zero from a missing player row; do not infer DNP/VOID without exact participation and contract rules.
Future ingestion/settlement may resolve exact outcomes. If still absent at final archive, preserve the row OPEN with its blocker and exclude from settled hit rate.
No historical freeze may be reconstructed.

## Validation
-686 total =488 regular +198 postseason; zero unsafe flags, late freezes or postseason evidence-label violations.
-Pick20 contract checks PASS; webpack and TypeScript PASS. Full local build blocked at missing configured Supabase build environment; no completed build claimed.
-Edge settlement/freeze/summary regression checks and3 postseason checks PASS; GitHub research-check green.
-Equilizer ten CSV SHA256 matches; original cohort parameters and holdout remain unchanged; GitHub guards green.
-Pulpy58 current tests PASS; GitHub invariants green.
-No Official Picks/APOSTAR/model/threshold changes or historical Odds API spending.

## Final seasonal shutdown checklist
1. Wait for final2026 postseason target; do not claim future games already captured.
2. Reconcile every genuine freeze and exact authoritative outcome; retain explicit OPEN/VOID/missed-capture states.
3. Preserve source manifests, hashes, settlements, summaries and consumed-holdout decisions.
4. Verify each engine's complete final inventory and snapshot separate phase/contract metrics.
5. Explicitly pause2026 capture schedules only after final capture/settlement; no schedule was disabled in this work.
6. Preserve all old PR evidence; unmerged older research remains historical/deferred, not automatically certified.
7. Reopen2027 only under a new predeclared season/cohort and untouched evaluation protocol.

## Restart2027
-No continuation of Equilizer's incomplete2026 counter.
-Rehearse real slate/quotes, strict-prior/as-of guards, immutable timing and exact settlements before activation.
-No probability/EV claim from historical hit rate. Calibration requires its own held-out gate.
-Pulpy requires complete seven-output common prospective captures, overlap/missingness gates and reserved untouched chronological holdout before training.
-Failed architectures stay closed; genuinely new architectures require development-only threshold selection and untouched evaluation.

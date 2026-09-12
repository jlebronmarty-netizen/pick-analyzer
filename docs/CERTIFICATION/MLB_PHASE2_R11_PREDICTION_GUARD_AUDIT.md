# R11 prediction-stage guard forensics

Status: **NOT CERTIFIED — historical veto evidence unavailable; production recovery pending.**

The starting production package is `d5b489ecb7060cbb6c4ce39060f2ec432408a985`. The failed run executed `415c8d749bff58c28724c8a923b81c677d756428`. The production bindings, R2I coordinator and diagnostic sanitizer are identical between those packages. R10 canonical read-model certification and `UI_REDESIGN_READY = YES` remain valid. This phase does not implement UI changes.

## Preserved-state findings

Read-only production inspection found one unresolved failed PREGAME run at revision 38, with completed SCOPE, DEPENDENCY_SCOPE, CONTEXTS and FEATURES checkpoints. Its 15-game scope contains 13 prepared contexts. One game was excluded for a missing starter; another was excluded for native evidence acquired after the freeze. The latter must not be relabeled as merely a missing-starter failure.

The failed run consumed MLB Official 2, Statcast 0 and Odds 0. Its preserved business journal contains one guarded native-game UPDATE with successful readback and no conflict. No prediction exists at its exact frozen prediction timestamp. The mission Odds counter remains 7/20. There is no active lease. Private forensic captures retain the full failure object, references, accounting and game matrix outside Git.

All 13 reconstructed contexts match their exact frozen checkpoint digests. Readback verifies 130 linked snapshots and 104 daily feature rows, including 26 team, 26 starter, 26 bullpen, 13 matchup and 13 first-inning rows. Batter daily rows are zero in this certified aggregate feature path; missing batter rows were not manufactured. Each game has exactly 10 snapshot links. The existing builder reconstructs all 76 ordered inputs and the existing Champion generates 13 prediction payloads without any production write. Vector and lineage digests match. This is read-only reconstruction, **not 13 persisted predictions**.

## Specific diagnosis and its limit

The reproduced defect is **CANONICAL_VETO_DIAGNOSTIC_COLLISION**. The original sanitizer maps each of these distinct production-binding errors to the same code and same sanitized message:

- `CURRENT_STARTED_GAME_VETO`
- `CURRENT_GAME_IDENTITY_VETO`
- `CURRENT_STARTER_CHANGE_VETO`

The production call path and two-call accounting narrow the failure to the current-schedule prewrite veto after feature preparation. The first immutable schedule response is retained and passes all three checks for all 13 contexts at the failure timestamp. The second response used for veto-only revalidation is not persisted by this call path. Its changed status, identity or starter fields cannot be reconstructed from the first response or current native rows.

The disposable harness calls the actual production bindings with the preserved inputs. Independently changing status, scheduled time or starter creates three different exact exceptions that all collapse into the recorded historical failure. This proves the original veto is **NOT_UNIQUELY_IDENTIFIABLE** from retained evidence. It does not prove which change occurred historically. The original failure is not relabeled as successful, and no historical message is invented.

## Bounded diagnostic repair

The sanitizer now retains only five exact allowlisted native/current-game guard codes. Unknown codes, arbitrary suffixes, provider text and secret-like strings remain withheld. The runtime's second sanitization pass accepts the same sanitized result. No eligibility condition, prediction calculation, feature definition, timestamp rule, input digest, model artifact, read model or persistence behavior changes.

Deployment must keep the Function-side and Edge-side sanitizer compatible. Publishing this file to the Function alone while the old Edge sanitizer remains active could cause `FAILURE_SANITIZATION` rejection. This local diagnostic candidate is therefore not an operational deployment certificate.

## Validation and outstanding gates

The offline R11 harness verifies the classification collision, safe exact-code preservation, all 13 pinned feature/vector reconstructions, invalid starter/as-of/linkage/version/order/vector/model/input-digest rejection, and unaffected-subset veto success. It uses disposable PGlite and injected schedule responses, with global network transport forbidden. Run it with `R2S_VALIDATION_DIR` pointing to the private validation directory and its two private R11 captures. The public report contains structural counts and conclusions only.

The unaffected 12-game subset passes each injected veto scenario. The current coordinator still invokes the prewrite veto over the entire context set. **Partial-slate prediction persistence is not certified or repaired here.** A safe continuation requires durable per-game blocking and consistent downstream/checkpoint scope handling; removing the veto would not be a repair.

Gate 1 forensics and frozen input reconstruction are complete. Gate 2's exact historical veto and Gate 5's exact historical-failure reproduction are unavailable. The diagnostic defect itself is reproduced and its local repair tested. Gate 8 partial-slate persistence, Gate 9 production recovery, Gate 10 automation recovery and Gate 11 a new scheduled successful run remain pending. Negative tests are evidence for retained safety contracts, not substitutes for those gates.

The existing generic disposition requires every game in the frozen scope to have reached its start timestamp, plus fresh exact review-digest/accounting/readback checks. At inspection, that time gate had not passed. No disposition request, failed-run resume, Cron invocation, provider call, business/runtime DML or DDL was performed. The expired portion of the slate must not be reused for betting evaluation.

`R11_OPERATIONAL_FRESHNESS_RESTORED = NO`

`UI_REDESIGN_READY = YES` (unchanged R10 read-model certification)

`UI_IMPLEMENTATION_CAN_START = NO` (operational recovery preferred; not proven here)

Next work: certify durable game-level veto/checkpoint handling prospectively without claiming a historical cause, coordinate compatible server/Edge diagnostics, then apply the existing exact expired-run disposition only after its fresh guards pass and observe a genuinely eligible scheduled execution. Preserve the failed run, all committed evidence and mission accounting throughout.

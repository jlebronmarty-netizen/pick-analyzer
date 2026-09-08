# R2T-R2 stored parity and native-binding audit

Verdict: **MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION_BLOCKED**.

Prior package: `f98cc3022cabe137a32ed0d31fd76ace60182191`. The new package is the enclosing bounded local commit; resolve it with `git log -1 --format=%H -- docs/CERTIFICATION/MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION.json`. No push.

## What passes

The actual stored production prediction `612aa09f-6d63-4c57-9b57-560eeeed8a47` for game `824552` was read and compared at its original pregame as-of `2026-09-05T01:51:21.667Z`. Its Champion is `MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1`; feature set is `MLB_ML_FEATURE_SET_V1`. The same immutable R1 source cache contains 80,667 pitches from 270 dependency games, all available before the frozen as-of. No current or post-start source was substituted into the historical prediction.

| Comparison | Result |
| --- | --- |
| Stored home probability | 0.581585665313 |
| Reconstructed home probability | 0.5815856653133696 |
| Stored away probability | 0.418414334687 |
| Reconstructed away probability | 0.41841433468663036 |
| Maximum absolute error | Less than 3.7e-13; tolerance 1e-12 |
| Stored input digest | `85613791d32d1e6925a41f016b80fdc55a1fab4d049a6d61632daf626a9a950f` |
| Reconstructed input digest | Exact match |
| 76 features and ordering | PASS; exact values at the stored 12-decimal input precision |
| Artifact and preprocessing | Original certified artifact, coefficients, intercept, medians, means and standard deviations |

R1's JavaScript code-point sort put an ID ending `:10:1` ahead of `:1:1`. The database's text ordering used by certified 02I does the reverse. The unchanged historical builder uses the first encountered pitcher to distinguish starter/bullpen context, so this ordering difference changed bullpen features. The corrected binding uses explicit en-US text comparison. A complete sampled game's database order matches it, and the exact stored input digest independently verifies the reconstructed 76-input state. Feature definitions and formulas were not changed to fit the probability.

The 02I pure helpers are now import-safe; their function bodies remain unchanged. The parity check uses the actual 02I stored-input serializer, including team identities, feature version, starter/data states, and missingness. The shorter legacy R2F executor digest has **not** been integrated with that contract yet.

## Gate 4 stop

The user's instruction is explicit: **“If production data migration would be required, STOP and classify separately.”** This investigation reaches that boundary. Current native rows already exist and lack required same-game evidence. Code projection can recover some fields, but cannot repair the missing physical source state without separately scoped evidence recovery and production data repair. No such repair or migration was executed.

All 15 inspected September 8 native games were inventoried across 18 required fields:

| Fields | Current physical state | Safe code projection | Unresolved |
| --- | --- | --- | --- |
| home_team_id / away_team_id | Missing in 15/15 | Existing MLB Official ID observations resolve existing canonical team IDs | 0 |
| game_type | Missing in 15/15 | No calendar/season guess | 15 |
| metadata.officialDate | Missing in 15/15 | No fabricated copy of a derived date | 15 |
| metadata.abstractGameState | Missing in 15/15 | No fabricated provider state | 15 |
| Home/away probable pitcher metadata | Nested under starter_evidence | Preserve actual stored pitcher IDs | One unknown on each side, game 823092 |
| Target, dates, doubleheader, game number, source/digest, season, status, observation timestamps | Present | Preserve existing fields | 0 missing |

The canonical JSON includes every inspected native row, per-field affected game list, physical source, consumer, safe derivation and block. Prior native observations resolve aliases; no new identity table or provider lookup was added. Conflicting aliases fail closed. Projections do not mutate input rows. Same-game game type/date/state cannot be recovered from a source digest or from a different game's metadata.

The schedule normalizer now preserves actual supplied game type, official date, abstract state and starter metadata through the existing native insert mapper. An injected historical schedule built only from observed fields passes the R1 target contract through that path. This prevents the same information loss on future supplied evidence; it does not retroactively fill existing production rows. Unknown evidence remains null/blocked.

## Gates not certified

Gates 1–2 pass and Gate 3 is complete. Gate 4 is blocked. Gates 5–19 were not executed after the required stop: real seven-domain persistence, per-entity canonical snapshot readback, post-persistence vector/inference parity, all-game generation, full R2B/R2I downstream traversal, checkpoint/resume and idempotency remain outstanding. R1's legitimate empty batter contract remains unchanged, but this audit does not claim a new batter persistence test.

Gate 20 passes: an actual R2B live-entrypoint call with trap providers/repository stops at the existing containment guard with zero side effects. Gate 21 is blocked: the legacy fixture implementation remains below that guard. Containment is not replacement completion. Gate 22 is partial: the new validator verifies stored-output/digest failure, alias conflicts and missing-evidence containment; R1's existing negative suite passes, but new persistence/executor negatives have not been implemented. Gate 23 passes for the bounded changes: 73 source-body/file parity checks preserve the business algorithms.

## Validation and protected state

- Dedicated R2T-R2: 20 checks PASS; overall nonzero BLOCKED result at Gate 4.
- R2T-R1: PASS, 41 checks. R2T: still BLOCKED, 29 checks and three historical cases; not falsely relabeled PASS.
- Legacy frozen/R2A/R2D/R2F/R2G/R2H/R2K: PASS.
- R2I/R2L/R2M/R2N/R2O/R2P/R2Q/R2R/R2S: expected live-containment incompatibilities. R2M and R2Q additionally show the existing Windows teardown assertion after the containment error. None is counted as PASS.
- Nine relevant feature/model validators: PASS. Validation of existing model/training artifacts performs no training or promotion.
- `npm.cmd run build`: exit 0, 400 static pages. Changed-file ESLint: five scripts, zero warnings. Final whitespace and targeted secret checks are recorded in the canonical JSON.
- Read-only network ledger: 140 requests, zero forbidden requests. Provider calls = 0; production DML = 0; production DDL = 0. Live refresh, training, Champion changes, automation, cron and settlement = 0.
- All 19 inherited generated-artifact files remain byte-identical to the inherited state and excluded from the commit. `.tmp/` and `.worktrees/` were not accessed or modified; legacy cache operations were redirected into OS temporary directories.

Canonical evidence: [R2T-R2 JSON](MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION.json). Supplemental logs and the complete reconstructed lineage are in `C:/Users/jlebr/AppData/Local/Temp/pick-analyzer-r2tr2-oBXFBO`; validator stacks are in `pick-analyzer-r2s-rUj44N` and `pick-analyzer-r2tr2-stack-xfcomh` under the same OS temporary root. These supplemental files do not replace the canonical artifact.

## Required next work

Resolve Gate 4 through a separately authorized, bounded same-game evidence recovery/data-repair phase. Review exact proposed production changes before any mutation. Then resume R2T-R2 gates 5–23 from this preserved implementation. **R2T Completion Readiness = NO. R2B Live Execution Ready = NO.** Do not advance to `MLB_DATA_02R_R2T_R3_LIVE_REENABLEMENT_CERTIFICATION` until full R2T-R2 certification passes.

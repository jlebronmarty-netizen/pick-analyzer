# R11-R1 per-game veto and partial-slate persistence

Local certification: **PASS**. Deployment, expired-run disposition and the next genuine production run are separate pending gates. This certificate does not claim restored production freshness.

Starting local package: `fba7e2b84c58d76dc6ef267a89e27cd11ec6f060`. Production baseline: `d5b489ecb7060cbb6c4ce39060f2ec432408a985`. The exact ten-file Edge candidate is defined by `MLB_PHASE2_R11_R1_EDGE_MANIFEST.json` in the containing commit.

## Contract

Current evidence is veto-only. It never replaces frozen inputs. Per-game outcomes are ELIGIBLE, BLOCK_MISSING_STARTER, BLOCK_STARTER_CHANGE, BLOCK_GAME_IDENTITY, BLOCK_STARTED, BLOCK_POST_FREEZE_EVIDENCE, BLOCK_STALE_EVIDENCE, BLOCK_FEATURE_INCOMPLETE or BLOCK_OTHER_CERTIFIED_REASON. Existing initial evidence exclusions retain their exact reason codes; the public execution result also gives their classification.

Before a downstream INSERT batch, the production bindings classify each candidate context independently. Blocked targets receive an immutable first-veto record containing game identity, exact allowlisted reason, stage, observation time and evidence digest. The record is checkpointed before remaining eligible rows can be written. There are at most 50 records, within the existing checkpoint and failure-headroom limits. No new table or DDL is required.

The original scope, contexts, snapshot references and accounting are preserved. Effective downstream scope can only exclude games. On resume, blocked contexts are not reconstructed from changed native evidence; every remaining context must still match its original per-game digest. The original aggregate evidence reference remains unchanged. Original market references are read back in full, while only non-vetoed predictions may feed subsequent value/policy decisions.

The existing INSERT_ELIGIBLE / REUSE_NO_OP / BLOCK_CONFLICT classifier still checks immutable row contents, exact identity, scope, physical numeric coercion, caps and independent readback. A per-game veto filters the admitted batch; it does not convert conflicts into reuse. The Edge transaction authority independently rejects prediction, mapping, observation, value and pick writes for vetoed targets. A caller cannot remove or alter a prior veto to re-enable that target.

Global failures remain fail-closed: malformed schema/payload, model or feature-manifest drift, immutable conflicts, provider transport/budget failures, lease/fence races and transaction-time started-game guards do not become arbitrary per-game skips. Feature construction, Champion inference, missing-value preprocessing, value mathematics and Policy V1 are unchanged. Existing market-freshness prewrite checks remain enforced.

An all-blocked effective scope terminates as NO_VALID_PREGAME_SLATE, without an Odds acquisition or manufactured predictions. Previously committed rows remain intact.

## Frozen historical matrix

Only evidence available at the original freeze establishes historical input eligibility. All 13 prepared contexts match frozen digests; their 130 snapshots existed by the freeze and contain 10 linked snapshots and 76 ordered inputs per target. Of the other two targets, one has the known missing-starter exclusion and one has the known post-freeze native-evidence exclusion. No current started/final status is used to rewrite that matrix.

The later veto-only schedule response was not retained. The historical reason remains **UNRECOVERABLE_HISTORICAL_VETO_DETAIL** for the prepared targets. This local prospective certification does not identify the historical veto or claim the failed run succeeded.

## Disposable production-shaped proof

The actual R2B/R2I coordinator, production bindings, physical SQL schema, real frozen vectors, unchanged Champion, durable runtime client, checkpoint store and fenced writer run against disposable PGlite. Provider responses are injected; there is no production transport.

- Start with the 13 preserved prepared contexts and two initial exclusions.
- Inject five independent vetoes: missing starter, changed starter, started game, changed game identity and post-freeze native evidence.
- Interrupt after those five vetoes commit and before prediction insertion.
- Release the lease, construct another authority/client instance and resume the original run.
- Persist 8 predictions, 8 mappings, 16 observations and 16 values. Policy V1 selects 0 picks, which is valid.
- Verify every downstream row belongs to the eight eligible targets. The five vetoed games persist no predictions.
- Repeat with 0 inserts and 0 additional provider requests; original references and accounting remain intact.
- Add a later veto and resume another instance: 7 predictions and 14 values remain eligible for downstream reuse, while all 8 committed predictions and 16 committed values remain in SQL.
- Veto the remaining targets: clean empty-scope completion, no reacquisition, no deletion.
- Reject veto removal, out-of-scope veto identities and all five downstream write targets before business SQL.

Eight new integration groups pass, alongside 74 physical-schema/real-Champion checks, 24 prior R11 safety checks, 21 runtime checks, 8 fenced-write checks, 5 R7 durability/midnight checks, 4 security checks, 17 R10 read-model checks and 17 readiness checks. The build passes. The actual candidate handler rejects missing/wrong/public credentials with 401 before any database connection, and accepts server-only inspect with 200.

Reproduce using the existing private validation directory and caches: set `R11_R1_VALIDATE=1` when running `scripts/mlb-operational-feature-schema-validate.mjs`. The private disposable SQL archive and source captures remain outside the repository. Committed evidence is aggregate-only.

## Deployment and production gates

The paired candidate includes the existing R11 exact diagnostic-code repair. Mandatory server-only bearer authentication remains unchanged with `verify_jwt=false`; no anonymous mutation is permitted. The privileged changes are limited to validated per-game checkpoint records, their immutability, and additional downstream write rejection. No new runtime operation, schema change or permission broadening is introduced.

Fresh production readback preserves the historical failed revision 38, its exact checkpoint, original freeze and DML journal. Mission Odds remains 7/20. This phase has made 0 provider calls and 0 production DML/DDL. The existing disposition time/state guard remains authoritative; no expired prediction or fresh Odds reconstruction is attempted.

After exact-candidate deployment and host readback, safely disposition the historical run only when the existing guard passes. Then observe a genuine scheduled pregame execution. Until that production proof exists:

- R11_OPERATIONAL_FRESHNESS_RESTORED = NO
- UI_REDESIGN_READY = YES (preserved R10 read-model certification)
- UI_IMPLEMENTATION_CAN_START = NO

No UI implementation is included.

## Authorized deployment readback

R11-R1 exact deployment certified: Edge v13 matches all ten ae65ff3 manifest files with no extras; production missing/wrong/public bearer tests return401, server-only inspect200. Paired Vercel ae65ff3 is READY and system version/unattended schema preflight PASS. Fresh readback preserves failed revision38, checkpoint, freeze and provider/DML accounting; Odds7/20, phase provider/DML/DDL0. At 2026-09-12T00:49:55Z three frozen games remain future-scheduled; last start02:15Z (22:15PR), so disposition and production host-dry/veto observation remain guarded. Eight disposable partial-slate groups PASS again. Do not invent historical veto or bypass time guard. Next: fresh guarded disposition, then genuine scheduled partial-slate production readback. R11_OPERATIONAL_FRESHNESS_RESTORED=NO; R10 UI_REDESIGN_READY=YES; UI_IMPLEMENTATION_CAN_START=NO. Earlier entries below are historical.

Production veto mutation/rejection observations remain pending; the deployed code is identical to the disposable SQL-tested authority, but that is not a substitute for actual production observation. No synthetic business data or historical veto was written. No disposition command was sent while three targets remained future-scheduled. Cron configuration is unchanged. The subsequent genuine scheduled production run remains pending.

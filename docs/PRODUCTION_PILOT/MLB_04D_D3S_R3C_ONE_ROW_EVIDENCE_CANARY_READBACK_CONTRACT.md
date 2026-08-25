# MLB-04D-D3S-R3C One-Row Evidence Canary Readback Contract

Classification: `MLB_04D_D3S_R3C_ONE_ROW_EVIDENCE_CANARY_READBACK_CONTRACT_CERTIFIED`

R3C completes the one-row immutable evidence canary contract left blocked after R3B deployment certification. The canary path is no longer a thin wrapper around batch persistence. It now has an explicit single-row execution contract:

- validate execute mode and canary-specific authorization
- require one selected deterministic identity
- require exactly one frozen payload
- pre-read by deterministic identity before mutation
- classify 0 exact matches as insert eligible
- classify 1 exact match as `REUSE_NO_OP`
- classify more than 1 exact match as `BLOCK_DUPLICATE_DEFECT`
- immediately read back after insert/reuse
- compare immutable fields for write/readback parity

Continuous natural D3W evidence persistence remains guarded by `MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED`. The canary guard does not authorize background writer persistence, snapshot writes, or research-ledger writes.

This certification used deterministic fixtures only. It did not run a real evidence canary, write production evidence, write snapshots, write ledger rows, call providers, activate automation, or add cron.

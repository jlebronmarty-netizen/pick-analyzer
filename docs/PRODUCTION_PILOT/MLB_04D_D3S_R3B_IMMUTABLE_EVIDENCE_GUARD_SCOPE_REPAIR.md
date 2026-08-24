# MLB-04D-D3S-R3B Immutable Evidence Guard Scope Repair

Classification: `MLB_04D_D3S_R3B_IMMUTABLE_EVIDENCE_GUARD_SCOPE_REPAIR_CERTIFIED`

This repair closes the authorization-scope defect discovered during the D3S-R3 one-row evidence canary. The canary correctly selected one CIN @ SF opportunity, but the deployed natural D3W evidence hook interpreted the broad legacy evidence flag as authorization to persist every eligible opportunity in the refresh batch, producing an 18-row evidence delta instead of the intended one-row canary.

## Guard Contract

Continuous D3W evidence persistence now requires:

- `MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED=true`
- execute mode
- the existing D3W stored-odds generation path

One-row canary persistence now requires:

- `MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED=true`
- execute mode
- exactly one evidence row
- a selected deterministic identity matching that row

The legacy `MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZED` flag no longer authorizes broad continuous writes and must not be used as a production-wide switch.

## Certification Scope

This phase performed code/design certification only.

- Provider calls: 0
- Production database mutations: 0
- Prediction writes: 0
- Snapshot writes: 0
- Evidence writes: 0
- Ledger writes: 0
- Automation activation: NO
- Active cron changes: 0

The 18 incident rows remain preserved as production evidence and are not deleted, rewritten, or backfilled.

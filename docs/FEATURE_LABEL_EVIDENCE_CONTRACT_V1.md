# Feature Label Evidence Contract V1

Status: implemented as validation bridge.

## Accepted Sample Fields

Every accepted feature/label sample must prove:

- prediction ID
- canonical event ID
- game start
- prediction timestamp
- feature cutoff
- maximum source timestamp when available
- feature version
- model version
- market
- predicted probability
- deterministic outcome
- label
- settlement version
- quality tier
- acceptance reason
- lineage

## Rejection Reasons

- `REJECTED_NO_FEATURE_SNAPSHOT`
- `REJECTED_LEAKAGE_RISK`
- `REJECTED_IDENTITY_MISMATCH`
- `REJECTED_INVALID_SETTLEMENT`
- `REJECTED_TEST_OR_LEGACY`
- `REJECTED_UNSUPPORTED_MARKET`
- `REJECTED_INSUFFICIENT_QUALITY`
- `REJECTED_DUPLICATE`

Historical/Replay performance remains separate from Production Performance.

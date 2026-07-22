# Prediction Family And Deduplication

Current-facing views should use one latest row per:

`sport + event + market + selection + line + model family + operating day`

Rows remain stored for audit, but user-facing current views should classify them as:

- `CURRENT`
- `SUPERSEDED`
- `HISTORICAL_VERSION`
- `SHADOW`
- `OFFICIAL`
- `INVALID`
- `LEGACY`
- `TEST_FIXTURE`

The 2026-07-22 audit found repeated logical market groups in recent MLB rows. They are not deleted; current views must suppress duplicates while preserving history.


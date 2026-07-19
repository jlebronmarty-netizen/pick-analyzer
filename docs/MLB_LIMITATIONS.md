# MLB Limitations

Status: Production Stable, Provider Limited
Version: MLB Production Complete v1.0.0

## Current Limitations

- Confirmed lineups remain unavailable unless provider/source entitlement supplies them.
- Detailed injury feed remains subscription/provider limited.
- Injury diagnosis, body part, severity and expected return are not inferred.
- Player role/importance is not inferred without grounded historical playing time or role data.
- Some composite internal diagnostics can be slow and may time out in broad external 30-second smoke tests.
- Historical sample growth is still needed for stronger calibration and learning confidence.
- Bullpen workload sample and closer/role availability remain partial.
- Unsupported markets are intentionally not available for production recommendations.
- Arbitrage remains unavailable without verified multi-book simultaneous prices.

## Not Limitations

The following are no longer architecture blockers:

- Operating-day lifecycle.
- Current Board read path.
- Dashboard Today contract.
- Provider budget and capability reporting.
- Feature Store integration contract.
- Model versioning and challenger isolation.
- Settlement and replay contracts.
- Learning/calibration gating.

## Maintenance Recommendations

Future MLB work should be limited to:

- Bug fixes.
- Provider upgrades.
- UI polish.
- Performance improvements.
- Security updates.
- Documentation refreshes.
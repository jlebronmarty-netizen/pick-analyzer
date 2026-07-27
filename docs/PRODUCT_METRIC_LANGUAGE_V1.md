# Product Metric Language V1

Generated: 2026-07-27

## Canonical Meanings

| Term | User-facing meaning | Boundary |
| --- | --- | --- |
| Probability | Estimated likelihood of the selected outcome. | Not confidence, trust, edge or recommendation status. |
| Confidence | How strongly the system trusts that probability estimate. | Not the chance the outcome will happen. |
| Quality | Completeness and reliability of the underlying inputs. | Not model skill by itself. |
| Trust | Historical model reliability metric. | Not a single-pick probability. |
| Readiness | Whether a sport, model or workflow has enough data and infrastructure for its current operating mode. | Not proof that a pick should be recommended. |
| Risk | Uncertainty, volatility, correlation and missing-information exposure. | Not bankroll sizing. |
| Projection | Model-generated informational estimate. | Not an Official Pick. |
| Recommendation | Policy-approved instruction or pick. | Must remain separate from projection-only surfaces. |
| Official Pick | Recommendation-policy output that passed production gates. | Must not be inferred from high probability alone. |
| Value | Relationship between model estimate and verified market price. | Requires reliable market price; not available from projection-only rows. |
| Edge | Difference between model estimate and verified market-implied probability. | Requires verified market data; not present in Probability Picks V1. |

## Audit Findings

- Probability Picks previously used probability, confidence, quality and risk as numeric ranking inputs but did not explain the distinction in the visible workspace.
- Performance and Dashboard generally separate probability from trust, Brier and calibration, but several operator panels remain technical and should stay under Operations or Administration.
- Arbitrage and market comparison screens correctly block claims when multi-book or same-event market data is unavailable.
- Player Projections correctly says Projection Only and No betting recommendation where sportsbook markets do not overlap.

## Safe Fixes Completed

- Probability Picks now displays explicit Probability, Confidence and Quality meanings.
- Probability Picks cards now show data status and sport eligibility certification.
- No numeric formulas or thresholds were changed.

## Certification

PRODUCT_METRIC_LANGUAGE_PASS
PROBABILITY_CONFIDENCE_CLARITY_PASS
NO_PROBABILITY_LOGIC_CHANGE_PASS

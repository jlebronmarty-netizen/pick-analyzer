# Training Feature Contract V1

Date: 2026-07-29

Status: EXECUTABLE TRAINING CONTRACT

No model training. No production mutation. No production prediction changes.

## Required Metadata

Every training feature contract entry carries feature key, canonical name, category, source, source table or payload, value type, sport support, market support, earliest availability rule, cutoff availability, frozen timestamp requirement, mutability, training eligibility, research eligibility, leakage severity, aliases, replacement key, deprecation state, rationale and contract version.

## Eligibility Contract

| Eligibility | Count |
| --- | --- |
| TRAINING_ALLOWED | 372 |
| TRAINING_ALLOWED_IF_CUTOFF_FROZEN | 33 |
| TRAINING_PROHIBITED_MODEL_OUTPUT | 18 |
| TRAINING_PROHIBITED_POST_FINAL | 14 |
| TRAINING_RESEARCH_ONLY | 11 |
| TRAINING_UNKNOWN_REVIEW_REQUIRED | 1 |

## First Model Boundary

The first future MLB logistic regression candidate may consume only Tier A/B keys classified as `TRAINING_ALLOWED` or `TRAINING_ALLOWED_IF_CUTOFF_FROZEN`. Market features require event, market, source and timestamp proof. Labels, settlement, model outputs, recommendation outputs, Trust, Official Pick status, edge, EV, confidence, probabilities, closing lines and post-final data are excluded.

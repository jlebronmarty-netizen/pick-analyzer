# Training-Safe Feature Governance V1

Date: 2026-07-29

Status: TRAINING-ONLY GOVERNANCE CONTRACT

No model training. No production mutation. No provider calls. No production prediction changes.

## Contract Summary

- Contract version: training_feature_governance_v1
- Feature keys classified: 449
- Critical leakage keys resolved: 29
- High governance keys resolved: 7
- Cutoff-frozen market candidates resolved: 35
- Candidate non-leakage keys resolved: 378

## Classification

| Classification | Feature keys |
| --- | --- |
| TRAINING_ALLOWED | 372 |
| TRAINING_ALLOWED_IF_CUTOFF_FROZEN | 33 |
| TRAINING_PROHIBITED_MODEL_OUTPUT | 18 |
| TRAINING_PROHIBITED_POST_FINAL | 14 |
| TRAINING_RESEARCH_ONLY | 11 |
| TRAINING_UNKNOWN_REVIEW_REQUIRED | 1 |

## Quality Tiers

| Tier | Feature keys |
| --- | --- |
| TIER_A_CORE | 176 |
| TIER_B_RECOMMENDED | 196 |
| TIER_C_OPTIONAL | 7 |
| TIER_D_EXPERIMENTAL | 27 |
| TIER_R_RESEARCH_ONLY | 11 |
| TIER_X_PROHIBITED | 32 |

## Enforcement Rule

Future dataset builders must default-deny unknown keys, exclude prohibited keys, isolate research-only keys, resolve aliases before matrix construction and require temporal proof for cutoff-frozen market fields. This governance layer references existing Feature Store Core and Multi-Sport Feature Registry concepts, but it does not replace or alter live prediction feature consumption.

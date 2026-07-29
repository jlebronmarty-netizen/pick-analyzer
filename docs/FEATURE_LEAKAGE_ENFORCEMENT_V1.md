# Feature Leakage Enforcement V1

Date: 2026-07-29

Status: VALIDATED LEAKAGE ENFORCEMENT

No model training. No production mutation. No provider calls.

## Fixture Results

| Fixture | Expected | Actual | Pass |
| --- | --- | --- | --- |
| final score used as feature | TRAINING_PROHIBITED_POST_FINAL | TRAINING_PROHIBITED_POST_FINAL | PASS |
| game result status | TRAINING_PROHIBITED_POST_FINAL | TRAINING_PROHIBITED_POST_FINAL | PASS |
| settled outcome | TRAINING_PROHIBITED_SETTLEMENT | TRAINING_PROHIBITED_SETTLEMENT | PASS |
| profit | TRAINING_PROHIBITED_LABEL | TRAINING_PROHIBITED_LABEL | PASS |
| model probability | TRAINING_PROHIBITED_MODEL_OUTPUT | TRAINING_PROHIBITED_MODEL_OUTPUT | PASS |
| confidence | TRAINING_PROHIBITED_MODEL_OUTPUT | TRAINING_PROHIBITED_MODEL_OUTPUT | PASS |
| edge | TRAINING_PROHIBITED_MODEL_OUTPUT | TRAINING_PROHIBITED_MODEL_OUTPUT | PASS |
| recommendation | TRAINING_PROHIBITED_RECOMMENDATION_OUTPUT | TRAINING_PROHIBITED_RECOMMENDATION_OUTPUT | PASS |
| Official Pick status | TRAINING_PROHIBITED_RECOMMENDATION_OUTPUT | TRAINING_PROHIBITED_RECOMMENDATION_OUTPUT | PASS |
| Trust | TRAINING_PROHIBITED_MODEL_OUTPUT | TRAINING_PROHIBITED_MODEL_OUTPUT | PASS |
| mutable closing line | TRAINING_PROHIBITED_MUTABLE_MARKET | TRAINING_PROHIBITED_MUTABLE_MARKET | PASS |
| valid cutoff-frozen odds | TRAINING_ALLOWED_IF_CUTOFF_FROZEN | TRAINING_ALLOWED_IF_CUTOFF_FROZEN | PASS |
| valid pregame pitching feature | TRAINING_ALLOWED | TRAINING_ALLOWED | PASS |
| unknown feature key | TRAINING_UNKNOWN_REVIEW_REQUIRED | TRAINING_UNKNOWN_REVIEW_REQUIRED | PASS |
| research-only key | TRAINING_RESEARCH_ONLY | TRAINING_RESEARCH_ONLY | PASS |

## Temporal Fixtures

| Fixture | Expected safe | Actual safe | Pass |
| --- | --- | --- | --- |
| valid cutoff-frozen odds temporal check | true | true | PASS |
| post-start odds temporal check | false | false | PASS |
| missing timestamp temporal check | false | false | PASS |

## Enforcement

- Prohibited fields never silently enter the model-input matrix.
- Unknown fields default deny as `TRAINING_UNKNOWN_REVIEW_REQUIRED`.
- Research-only fields remain available for audit partitions but are excluded from model inputs.
- Labels are separated from model inputs.
- Cutoff-frozen market features require timestamp and identity proof.

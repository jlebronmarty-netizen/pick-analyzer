# P1.3 Production Evaluation Policy Certification

Verdict: local implementation pending production deployment.

## Certification Claim

P1.3 separates production evaluation from recommendation quality. The repository now has a deterministic `production_evaluation_policy_v1_3` evaluator and the MLB prospective preview writer stores that contract in future prediction snapshots.

## Required Policy Answers

| Question | Answer |
| --- | --- |
| Are all valid pregame predictions eligible for production evaluation? | Yes, prospectively, when data-integrity and scope blockers are absent. |
| Are low confidence, low EV or low edge recommendation blockers? | Yes. |
| Do low confidence, low EV or low edge automatically block production evaluation? | No. |
| Are recommendation eligibility and production evaluation separate? | Yes. |
| Does this change Official Pick policy? | No. |
| Does this promote 2026-08-02 rows? | No. |
| Does stale price evidence become a current-value claim? | No. It is preserved as a warning. |
| Were predictions, results, settlements or learning rows fabricated? | No. |

## Evidence

- `src/services/prediction-evaluation-policy.service.ts` defines the five-layer policy.
- `src/services/sportsdataio-mlb-prospective-preview.service.ts` persists `productionEvaluationPolicy` inside future `feature_snapshot` payloads.
- `scripts/p1-3-production-evaluation-policy-validate.mjs` verifies the policy separation and static safety boundaries.

## Historical Boundary

The 45 rows from 2026-08-02 remain non-production historical evidence. They are not rewritten, promoted or retroactively settled by this phase.

## Production Certification

Production certification must confirm:

- `/api/system/version` serves the P1.3 commit;
- homepage and read-only operational routes remain available;
- provider calls from certification reads remain 0;
- remote mutations from certification reads remain 0.

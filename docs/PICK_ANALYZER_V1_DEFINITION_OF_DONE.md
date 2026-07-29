# Pick Analyzer V1 Definition Of Done

V1 is done only when the product is truthful, operable and regression-free against the certified MLB core contract.

## Required Conditions

1. MLB core daily operation is certified from pregame refresh through Current Board visibility, canonical result sync, protected settlement, learning evidence and Performance visibility.
2. Non-MLB sports are clearly labeled as preview, data-only, unavailable or blocked unless their own end-to-end lifecycle is certified.
3. Unsupported markets cannot appear as available recommendations.
4. Recommendation copy separates likely outcomes, positive EV, Official Picks, projection-only surfaces and unsupported markets.
5. Provider budget policy is active before any provider-backed refresh.
6. Adaptive refresh uses due-domain logic and does not rely on flat all-sport 5-minute polling.
7. Automatic model training is disabled unless a future approved training phase passes sample, leakage, challenger and promotion gates.
8. Dashboard, Current Board, Probability Picks, Performance, AI Operations, Operations, Data Coverage and Providers routes are certified against the V1 product contract.
9. JSON artifacts validate.
10. Documentation links for V1 artifacts resolve.
11. Changed-file ESLint passes or is not applicable for documentation-only changes.
12. `git diff --check` passes.
13. Secret scan passes.
14. Build passes for the release-candidate payload.
15. Production smoke evidence is recorded without relying on the unreliable Windows local smoke harness.

## V1 Is Not Done If

- The product implies non-MLB production recommendations.
- Any unsupported market is promoted as available.
- Result, settlement, learning or Performance evidence is stale, missing or mislabeled.
- Provider calls exceed policy or occur without a due-domain reason.
- Training, epoch activation or model-weight mutation occurs without explicit certification.
- A known P0 or P1 platform regression remains unresolved.

## Certification Markers

- `DEFINITION_OF_DONE_PASS`
- `NO_CODE_CHANGE_PASS`
- `NO_PROVIDER_CALL_PASS`
- `NO_PRODUCTION_MUTATION_PASS`
- `NO_CERTIFIED_PLATFORM_REGRESSION_PASS`

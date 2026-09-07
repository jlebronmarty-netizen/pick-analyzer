# MLB-DATA-02R-R2 Frozen Execution Package

Certification: `MLB_DATA_02R_R2_FROZEN_EXECUTION_PACKAGE_COMPATIBILITY_CERTIFIED`

- Execution package strategy: `EPHEMERAL_FROZEN_GIT_WORKTREE_OR_DETACHED_SHA`
- Production web SHA: `7bc44efba2aaa7a5ea64d57e8bd2e44b47aaa987` (observability only)
- DB contract compatibility: `PASS`
- Champion: `MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1`
- Feature set: `MLB_ML_FEATURE_SET_V1`, 76 features
- Runner state: `RUNNER_EXISTS_AND_CERTIFIED`
- Dry-run provider calls: 0
- Dry-run production DML: 0
- Dry-run production DDL: 0
- Execution without future authorization fails closed with `DAILY_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2_AUTHORIZATION`.

Production web deployment equality is not a hard gate for the manual runner. The runner freezes the execution package SHA and guards the database/model/provider contract instead.

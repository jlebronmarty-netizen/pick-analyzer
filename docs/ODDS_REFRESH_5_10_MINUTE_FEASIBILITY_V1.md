# Odds Refresh 5-10 Minute Feasibility V1

Date: 2026-07-29

Status: FEASIBILITY ONLY

No cadence change. No provider calls. No production mutation.

## Local Smoke Classification

`LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS`: two independent bounded PowerShell local-smoke wrappers exceeded their hard timeouts. This is not treated as an application-route failure, and no replacement local server lifecycle is part of this feasibility certification.

## Recommendation

Use adaptive refresh, not flat 5-minute refresh across all sports: 60 minutes more than 24 hours out, 15 minutes from 2-24 hours, 5-10 minutes under 2 hours, and stop pregame refresh after event start.

| Scenario | Sports | Interval | Calls/day | Credits/month | DB growth risk | Sustainability |
| --- | --- | --- | --- | --- | --- | --- |
| A_MLB_ONLY_10_MIN | 1 | 10m | 288 | 8640 | MEDIUM | POSSIBLE_AFTER_PROVIDER_BUDGET_CONFIRMATION |
| B_MLB_ONLY_5_MIN | 1 | 5m | 576 | 17280 | MEDIUM | POSSIBLE_AFTER_PROVIDER_BUDGET_CONFIRMATION |
| C_SUPPORTED_SPORTS_10_MIN | 6 | 10m | 1728 | 51840 | HIGH | UNSUSTAINABLE_WITHOUT_BUDGET_CONFIRMATION |
| D_SUPPORTED_SPORTS_5_MIN | 6 | 5m | 3456 | 103680 | HIGH | UNSUSTAINABLE_WITHOUT_BUDGET_CONFIRMATION |
| E_ADAPTIVE_REFRESH | 6 | 15m | 1152 | 34560 | HIGH | BEST_SAFE_POLICY |

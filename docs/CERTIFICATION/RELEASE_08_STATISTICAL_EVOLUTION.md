# Release 08 Statistical Evolution Certification

Status: LOCAL PASS / PRODUCTION DEPLOYMENT PENDING

Starting commit: `59f20b788ef72f655b1a4b1bdff0fcec4739d144`

## Scope

Release 08 creates the evidence-gated model evolution framework. It generates optimization candidates, applies statistical rejection rules, documents offline simulation requirements and adds a human approval workflow.

## Non-Changes

| Area | Status |
| --- | --- |
| Production probabilities | Unchanged |
| Prediction formulas | Unchanged |
| Official Pick policy | Unchanged |
| Learning weights | Unchanged |
| Scheduler behavior | Unchanged |
| Provider contracts | Unchanged |
| Historical outcomes | Unchanged |
| Historical replay | Not started |
| Experimental deployment | Not automatic |
| Database schema | Unchanged |

## Candidate Verdict

| Classification | Count |
| --- | ---: |
| APPROVED | 0 |
| REJECTED | 3 |
| NEEDS MORE DATA | 3 |

No candidate is approved for production because the evidence does not yet clear every threshold and regression guard.

## Local Validation

| Check | Result |
| --- | --- |
| Release 01 validator | PASS with four pre-existing circular-import warnings |
| Release 02 validator | PASS |
| Release 02A validator | PASS |
| Release 03 validator | PASS |
| Release 04 validator | PASS after Release 08 commit; pre-commit run rejects newer dirty Release 08 files by design |
| Release 05 validator | PASS after Release 08 commit; pre-commit run rejects newer dirty Release 08 files by design |
| Release 06 validator | PASS after Release 08 commit; pre-commit run rejects newer dirty Release 08 files by design |
| Release 07 validator | PASS after Release 08 commit; pre-commit run rejects newer dirty Release 08 files by design |
| Release 08 validator | PASS |
| Build | PASS |
| ESLint | PASS |
| JSON validation | PASS |
| Markdown validation | PASS via Release 01 validator |
| Secret scan | PASS via Release 08 validator |
| `git diff --check` | PASS |

## Production Verification Scope

Read-only production verification:

- `/api/system/version`
- `/api/model/segments`
- `/api/model/intelligence`
- `/api/performance`

Provider calls and database mutations must remain zero.

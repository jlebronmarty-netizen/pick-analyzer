# Release 06 Data Intelligence Certification

Status: LOCAL PASS / PRODUCTION DEPLOYMENT PENDING

Starting commit: `3bb7f8d3eedb5d71321878c1790880ae83d76646`

## Scope

Release 06 creates the analytical foundation needed for evidence-based model optimization by adding a read-only segment engine and two internal model APIs:

- `/api/model/segments`
- `/api/model/intelligence`

## Non-Changes

| Area | Status |
| --- | --- |
| Architecture | Unchanged |
| Infrastructure | Unchanged |
| Provider contracts | Unchanged |
| Scheduler behavior | Unchanged |
| Prediction formulas | Unchanged |
| Probability calibration | Unchanged |
| Official Pick thresholds | Unchanged |
| Learning weights | Unchanged |
| Settlement rules | Unchanged |
| Historical replay | Not started |
| Retrospective labels | Not generated |

## Analytical Dimensions

New read-only analytical dimensions:

- sport
- league
- season
- event
- event date
- home team
- away team
- selected side
- home/away flag
- favorite/underdog
- implied probability
- predicted probability
- confidence
- prediction source
- model version
- feature version
- feature snapshot coverage
- market
- edge
- expected value
- settlement result
- push/void state

## Local Validation

| Check | Result |
| --- | --- |
| Release 01 validator | PASS with four pre-existing circular-import warnings |
| Release 02 validator | PASS |
| Release 02A validator | PASS |
| Release 03 validator | PASS |
| Release 04 validator | PASS after Release 06 commit; pre-commit run rejects newer dirty Release 06 runtime files by design |
| Release 05 validator | PASS after Release 06 commit; pre-commit run rejects newer dirty Release 06 runtime files by design |
| Release 06 validator | PASS |
| Changed-file ESLint | PASS |
| Build | PASS |
| JSON validation | PASS |
| Markdown validation | PASS via Release 01 validator |
| Targeted secret scan | PASS via Release 06 validator |
| `git diff --check` | PASS |

## Production Verification Scope

Production verification must remain read-only:

- `/api/system/version`
- `/api/model/segments`
- `/api/model/intelligence`
- `/api/performance`

Provider calls and remote mutations must remain zero.

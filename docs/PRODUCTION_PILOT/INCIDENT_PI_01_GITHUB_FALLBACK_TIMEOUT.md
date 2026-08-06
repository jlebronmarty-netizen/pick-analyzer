# Production Pilot Incident PI-01: GitHub Fallback 15-Minute Timeout

Status: `CLASSIFIED_NO_RUNTIME_REPAIR_REQUIRED`

## Summary

Two scheduled GitHub fallback workflow runs consumed about 15 minutes and generated failure notifications during Production Pilot Week Day 2.

The incident did not prove a Pick Analyzer application-route defect. GitHub Actions job metadata shows both abnormal runs were cancelled before workflow steps were materialized. The fallback step did not begin, curl did not run, and the protected Pick Analyzer endpoint was not called by those runs.

## Incident Runs

| Run | Run ID | Event | Commit | Created | Completed | Conclusion | Duration | Job Conclusion | Step Evidence |
| --- | ---: | --- | --- | --- | --- | --- | ---: | --- | --- |
| #236 | 31122465867 | schedule | d8de4ca504017eb3ab455287d41c4adea5834116 | 2026-08-06T17:12:53Z | 2026-08-06T17:27:55Z | failure | 902s | cancelled | No steps returned by GitHub jobs API |
| #237 | 31126194967 | schedule | d8de4ca504017eb3ab455287d41c4adea5834116 | 2026-08-06T18:39:51Z | 2026-08-06T18:54:56Z | failure | 905s | cancelled | No steps returned by GitHub jobs API |

GitHub run logs could not be downloaded from this environment because the API returned HTTP 403 requiring repository admin rights.

## Normal Run Comparison

| Run | Run ID | Created | Conclusion | Run Duration | Fallback Step Duration |
| --- | ---: | --- | --- | ---: | ---: |
| #230 | 31070998442 | 2026-08-06T04:20:56Z | success | 6s | 1s |
| #231 | 31079749739 | 2026-08-06T07:07:56Z | success | 7s | 0s |
| #232 | 31090712808 | 2026-08-06T09:49:32Z | success | 5s | 0s |
| #233 | 31099045559 | 2026-08-06T11:52:39Z | success | 7s | 1s |
| #234 | 31105762797 | 2026-08-06T13:24:27Z | success | 11s | 3s |
| #235 | 31116503468 | 2026-08-06T15:34:52Z | success | 16s | 3s |
| #236 | 31122465867 | 2026-08-06T17:12:53Z | failure | 902s | Not started |
| #237 | 31126194967 | 2026-08-06T18:39:51Z | failure | 905s | Not started |

## Timeout Trace

| Timeout Source | Configured Value | Matches 15m? | Finding |
| --- | ---: | --- | --- |
| GitHub job `timeout-minutes` | 6 minutes | No | The abnormal jobs exceeded this but had no steps, so this did not run as a normal step/job timeout. |
| Workflow curl `--max-time` | 120 seconds | No | Curl did not start. |
| App planner continuity cap | 300 seconds | No | The app route was not invoked by #236/#237. |
| Vercel function timeout | Platform/app dependent | No evidence | No app invocation is visible for the failed runs. |
| Provider request timeout | 15-60 seconds depending service | No | No provider request was started by the failed fallback jobs. |
| Database statement timeout | Not evidenced | No | No app invocation/database work is tied to #236/#237. |
| GitHub hosted runner/concurrency queue cancellation | About 15 minutes observed | Yes | Job metadata shows cancellation before steps, which is consistent with a pre-step GitHub runner/concurrency/platform cancellation. |

## Fallback Contract Trace

Expected fallback contract:

GitHub scheduled fallback -> protected endpoint -> app checks Vercel primary lease -> if primary is recent, return `fallback_skip` quickly -> otherwise bounded protected execution.

Actual #236/#237:

- Workflow run was scheduled.
- Job was cancelled after about 15 minutes.
- GitHub jobs API returned no steps.
- The fallback step did not begin.
- The app protected endpoint was not called by those runs.
- No `fallback_skip`, provider call, mutation, or app heartbeat from those runs is visible.

Classification for both runs: `WORKFLOW_PRE_STEP_CANCELLED`.

## Primary Scheduler Evidence

Current production after the incident:

- Production commit: `d8de4ca504017eb3ab455287d41c4adea5834116`.
- Scheduler cadence: `HEALTHY`.
- Last Vercel primary success: `2026-08-06T21:48:04.526+00:00`.
- Last GitHub fallback success: `null`.
- Missed scheduler intervals: `0`.
- Provider calls today: `107`.
- Last provider call: `2026-08-06T21:48:04.545756+00:00`.

The app-side evidence proves Vercel primary is operating after the incident. It does not expose a historical primary-success snapshot for the exact #236/#237 start times through public read-only endpoints.

## Safety Impact

The failed fallback jobs did not reach the application, so they did not cause:

- duplicate provider acquisition;
- duplicate predictions;
- duplicate results;
- duplicate settlements;
- duplicate learning evidence;
- post-start market refresh;
- provider budget reserve violation;
- concurrent primary/fallback writes.

Certification reads made 0 provider calls and 0 remote mutations.

## Root Cause

Root cause classification: `OTHER_PROVEN_CAUSE`.

Specific cause: `GITHUB_HOSTED_RUNNER_OR_CONCURRENCY_PRE_STEP_CANCELLATION`.

Evidence: The failed GitHub jobs were cancelled after approximately 15 minutes with no steps returned by the GitHub jobs API. Because the workflow step never began, the incident occurred before curl and before the Pick Analyzer protected endpoint.

## Repair Decision

No runtime or workflow repair was made.

Reason: Repository configuration already bounds the fallback step with a 6-minute job timeout and 120-second curl timeout, and the app fallback contract exits quickly when Vercel primary lease evidence is recent. The failure happened before those controls executed.

## Pilot Decision

Day 2 ordinary certification remains paused until PI-01 is accepted.

Once accepted, Day 2 may resume with monitoring because:

- Vercel primary remains the certified primary scheduler;
- GitHub fallback failures did not execute application work;
- production scheduler health is currently healthy;
- no duplicate writes or provider waste were caused by #236/#237.

Do not begin Day 3. Do not begin MC-03.

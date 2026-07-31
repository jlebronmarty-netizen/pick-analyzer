# Pick Analyzer V2 Phase C1.1 External Scheduler Recovery

Date: 2026-07-31

Status: IMPLEMENTED PENDING FINAL PRODUCTION PROOF

Starting commit: `344a366107f14b6238e1650d1243ba321ca39164`

## Mission

C1.1 resumes Goal B from C1: completed games must automatically flow through protected operating-day execution, canonical settlement, learning evidence, Performance and settlement guarantee monitoring. C2 was not started.

## Source Of Truth Matrix

| Workflow | Trigger | Cron | Concurrency | Timeout | Endpoint | Auth | Defect | Repair |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `.github/workflows/production-operating-day.yml` | `schedule`, `workflow_dispatch` | Before: `*/10 * * * *`; after: `7-57/10 * * * *` | Before: `production-operating-day-runtime`; after: `production-operating-day-writer` | Before: 10 minutes; after: 6 minutes | `POST /api/cron/operating-day?dryRun=false` | `Authorization: Bearer ${CRON_SECRET}` | Shared concurrency with heartbeat, exact boundary cron, timeout equal to cadence | Isolate writer, avoid common boundary congestion, keep job bounded below cadence |
| `.github/workflows/production-operating-day-heartbeat.yml` | `schedule`, `workflow_dispatch` | `3,33 * * * *` | Before: `production-operating-day-runtime`; after: `production-operating-day-heartbeat` | Before: 10 minutes; after: 5 minutes | `POST /api/cron/operating-day?dryRun=true` | `Authorization: Bearer ${CRON_SECRET}` | Dry-run heartbeat could queue with write-capable scheduler | Isolate observer concurrency and keep it bounded |

## Root Cause

The application-side C1 repair was correct: production adaptive refresh selected `settle`. The remaining risk was external scheduler reliability and reporting. Repository evidence showed the write scheduler and dry-run heartbeat shared the same concurrency group, and the write job had a 10-minute timeout on a 10-minute cadence. Public GitHub metadata also showed successful scheduled runs, but sparse enough that operations health could become `CRITICAL` between stored protected lifecycle events.

## External Settings Evidence

- GitHub Actions workflows are active by public GitHub workflow metadata.
- Scheduled writer proof: run `30653457381`, event `schedule`, conclusion `success`, head `344a366107f14b6238e1650d1243ba321ca39164`, started `2026-07-31T18:00:45Z`.
- Scheduled heartbeat proof: run `30657102597`, event `schedule`, conclusion `success`, head `344a366107f14b6238e1650d1243ba321ca39164`, started `2026-07-31T18:55:37Z`.
- `CRON_SECRET` existence/value is not printed. It is supported by successful protected scheduled invocation evidence.
- Environment approval blocking is not observed in public run metadata; scheduled runs completed without approval.

## Settlement Evidence

Before automatic recovery, production settlement guarantee returned `409 ACTION_REQUIRED` with 12 recent ready-for-settlement rows, 51 total settlement-ready rows and 0 silent pending rows.

After the scheduled writer run, production settlement guarantee returned HTTP 200 with:

- checked predictions: 123
- completed prediction rows: 60
- settled rows: 60
- ready-for-settlement rows: 0
- blocked rows: 0
- silent pending rows: 0
- provider calls from the read-only check: 0

Adaptive refresh then reported settlement backlog 0 and moved to `midday_refresh` because odds were stale.

## Guarantee Repair

The settlement guarantee monitor now includes scheduler health fields:

- last successful protected invocation
- missed intervals
- next expected scheduler window
- scheduler cadence status
- late/critical flags
- action-required reasons

The route remains read-only. It returns `ACTION_REQUIRED` if settlement-ready rows remain, silent pending rows remain or the scheduler is late/critical.

## Safety

- No fabricated results.
- No settlement grading rule changes.
- No probability, confidence, EV, Trust or Official Pick policy changes.
- No model-weight mutation.
- No epoch mutation.
- No provider-plan, GitHub billing or Vercel billing changes.
- No secrets printed.
- No manual Vercel deployment.

## Validation

Primary validator: `scripts/pick-analyzer-v2-phase-c1-1-external-scheduler-recovery-validate.mjs`

Required follow-up validation includes C1, settlement-learning recovery, protected canonical MLB settlement, canonical settlement state, result ingestion, MLB operating-day recovery, scheduler health alignment, A3 scheduler/freshness, autonomous daily AI, performance validation, JSON validation, changed-file ESLint, targeted secret scan, `git diff --check`, `git diff --cached --check` and `npm.cmd run build`.

## Verdict

C1.1 can be certified only after the final repair commit is pushed, production serves it, the stricter settlement guarantee passes, and scheduler health no longer reports late/critical.

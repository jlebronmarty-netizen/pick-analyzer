# Pick Analyzer V2 Phase A3 Scheduler Freshness Audit

Generated: 2026-07-30T23:14:28.145Z
Baseline commit: 41315dd7d15615a9bedb856a892c59d4f0cb4762

## Verdict

PASS - scheduler/freshness reporting is coherent after scoped repairs.

## Scope

Bounded audit of scheduler configuration, heartbeat, adaptive refresh cadence, freshness semantics, health reporting and scheduler/freshness UI labels. No local server smoke, provider calls, prediction writes, result writes, settlement writes or learning writes were performed.

## Scheduler Inventory

| Process | Source of Truth | Configured Cadence | Reported Cadence | Timezone | Stale Threshold | Degraded Threshold | Mismatch | Severity | Repair |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| operating-day write scheduler | .github/workflows/production-operating-day.yml + src/config/mlb-operating-day-scheduler.ts | `*/10 * * * *` | `*/10 * * * *` | UTC trigger; America/Puerto_Rico operating date | 20 minutes scheduler window | one missed interval after 20 minutes; critical at two missed intervals | operations-health limitation text referenced Vercel daily cron | P1 | Updated operations-health limitation text to GitHub Actions ownership and empty Vercel cron state. |
| operating-day heartbeat | .github/workflows/production-operating-day-heartbeat.yml + src/config/mlb-operating-day-scheduler.ts | `3,33 * * * *` | `3,33 * * * *` | UTC trigger; America/Puerto_Rico operating state | observer-only; does not mutate stale state | reported through operations health when protected success evidence is late | None | NONE | None |
| MLB adaptive odds refresh | src/services/adaptive-refresh-orchestrator.service.ts | `60 early, 15 pregame, 10 near start; budget-gated` | `60 early, 15 pregame, 10 near start; budget-gated` | America/Puerto_Rico operating date | fresh cadence * odds aging multiplier | AGING/DUE_SOON before STALE/DUE_NOW | UI collapsed NOT_SUPPORTED/NOT_AVAILABLE freshness states | P2 | Updated UI tone mapping for NOT_SUPPORTED and NOT_AVAILABLE. |
| result ingestion, settlement and learning closure | existing operating-day service and lifecycle ledger | `results every 5 live / 15 postgame when due; settlement after authoritative final results` | `results every 5 live / 15 postgame when due; settlement after authoritative final results` | America/Puerto_Rico operating date | results stale after postgame policy window when active | pending/awaiting result remains visible, not healthy | None | NONE | None |

## Findings

- Configured cadences: GitHub write scheduler */10 * * * *; GitHub heartbeat 3,33 * * * *; Vercel crons disabled []; manual observer workflow_dispatch only
- Reported cadences: MLB autonomous writeSchedulerFrequency */10 * * * *; MLB autonomous heartbeatFrequency 3,33 * * * *; adaptive status configuredCrons owner github_actions schedule */10 * * * *
- Timezone findings: GitHub cron expressions are UTC triggers. Application operating date and UI timestamps use America/Puerto_Rico. No daylight-saving conversion is introduced for Puerto Rico.
- Freshness findings: Server freshness classifications remain authoritative. Stale thresholds are not shorter than configured fresh cadence. Future or missing timestamps are not classified as fresh by the existing safe-date/age logic.
- Health findings: Operations health distinguishes last attempt from last successful protected invocation. A late scheduler is reported as LATE/DEGRADED, not healthy. Read-only health routes expose GET only and do not execute provider refresh routes.
- UI findings: Data freshness UI now distinguishes NOT_SUPPORTED from NOT_AVAILABLE instead of collapsing both into a generic fallback tone. Adaptive operations panel displays Puerto Rico-local timestamps.

## Defects

| Severity | Area | Defect | Repair |
| --- | --- | --- | --- |
| P1 | operations-health scheduler reporting | Operations health still described a Vercel daily cron even though vercel.json contains no active crons and GitHub Actions owns the frequent scheduler. | Operations health limitation now states that Vercel crons are empty and GitHub Actions owns the write scheduler and heartbeat. |
| P2 | dashboard data freshness UI | DataFreshnessPreviewCard treated NOT_SUPPORTED and NOT_AVAILABLE as generic neutral fallback states instead of preserving server freshness semantics. | DataFreshnessPreviewCard now maps NOT_SUPPORTED and NOT_AVAILABLE to distinct disabled/unavailable tones. |

## Production Evidence

| Path | HTTP | Latency ms | Commit | Provider Calls | Mutations | Status | Scheduler |
| --- | ---: | ---: | --- | ---: | ---: | --- | --- |
| `/api/system/version` | 200 | 1224 | 41315dd7d15615a9bedb856a892c59d4f0cb4762 | 0 | n/a | n/a | n/a |
| `/api/operations/health` | 200 | 9701 | 41315dd7d15615a9bedb856a892c59d4f0cb4762 | 0 | 0 | DEGRADED | LATE |
| `/api/operations/adaptive-refresh/status` | 200 | 5079 | n/a | 0 | 0 | PARTIAL | n/a |
| `/api/operations/data-freshness` | 200 | 5043 | n/a | 0 | 0 | PARTIAL | n/a |
| `/api/operations/mlb-autonomous-operations` | 200 | 8547 | n/a | 0 | 0 | YES_MLB_CORE | */10 + 3,33 heartbeat |
| `/api/data-coverage/health` | 200 | 12809 | n/a | 0 | 0 | n/a | n/a |

## Safety Counters

- Provider calls: 0
- Provider credits: 0
- Database reads: production read-only endpoint observation only; local validator performs static file reads
- Database mutations: 0
- Prediction writes: 0
- Result writes: 0
- Settlement writes: 0
- Learning writes: 0

## Validation Results

- input exists: .github/workflows/production-operating-day.yml: PASS
- input exists: .github/workflows/production-operating-day-heartbeat.yml: PASS
- input exists: .github/workflows/operating-day-refresh.yml: PASS
- input exists: vercel.json: PASS
- input exists: src/config/mlb-operating-day-scheduler.ts: PASS
- input exists: src/services/operations-health.service.ts: PASS
- input exists: src/services/adaptive-refresh-orchestrator.service.ts: PASS
- input exists: src/services/mlb-autonomous-operations-v1.service.ts: PASS
- input exists: src/components/dashboard/DataFreshnessPreviewCard.tsx: PASS
- input exists: src/components/dashboard/AdaptiveOperationsPanel.tsx: PASS
- input exists: src/app/api/operations/health/route.ts: PASS
- input exists: src/app/api/operations/adaptive-refresh/status/route.ts: PASS
- input exists: src/app/api/operations/data-freshness/route.ts: PASS
- input exists: src/app/api/operations/mlb-autonomous-operations/route.ts: PASS
- input exists: src/app/api/cron/operating-day/route.ts: PASS
- input exists: docs/PROJECT_STATUS.md: PASS
- input exists: docs/MASTER_ROADMAP.md: PASS
- branch is main: PASS
- scheduler config write cron is canonical: PASS
- scheduler config heartbeat cron is canonical: PASS
- production workflow uses shared expected write cadence: PASS
- heartbeat workflow uses shared expected observer cadence: PASS
- manual operating-day workflow has no schedule cron: PASS
- vercel crons are disabled: PASS
- adaptive status reports GitHub Actions ownership: PASS
- MLB autonomous report imports canonical cron constants: PASS
- operations health no longer claims one Vercel daily cron: PASS
- operations health reports GitHub Actions ownership and Vercel empty crons: PASS
- operations health distinguishes last scheduler run and success: PASS
- operations health exposes next expected scheduler window: PASS
- operations health has late and critical scheduler states: PASS
- timezone contract uses Puerto Rico active event timezone: PASS
- freshness states include not available and not supported semantics: PASS
- UI freshness card maps NOT_AVAILABLE and NOT_SUPPORTED distinctly: PASS
- adaptive operations panel displays Puerto Rico timestamps: PASS
- read-only health routes expose GET only: PASS
- read-only health routes do not directly call provider execution routes: PASS
- obsolete 15-minute cron text absent from active runtime files: PASS
- no local server smoke lifecycle in A3 validator: PASS

## Remaining Risks

- Repository evidence cannot inspect GitHub Actions enablement/paused state in the GitHub UI.
- Production scheduler timeliness depends on future GitHub Actions execution and stored lifecycle rows; this phase certifies reporting consistency, not future run success.
- Read-only production endpoints can observe current status but cannot repair late lifecycle evidence without an authorized scheduler execution.

## Certification

PICK_ANALYZER_V2_PHASE_A3_SCHEDULER_FRESHNESS_PASS

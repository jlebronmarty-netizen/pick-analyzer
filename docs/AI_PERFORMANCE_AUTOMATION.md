# AI Performance Automation

AI Brain daily update reuses the existing post-settlement flow conceptually and exposes manual dry-run validation through:

- `/api/performance/daily-update`
- `/api/ai-performance-center/daily-update`

Defaults are dry-run and provider-call free.

When `dryRun=false` and migration `202607190001_ai_performance_snapshots_v1.sql` is applied, the service upserts idempotent daily snapshots. If the table is absent, the response returns a safe unavailable warning and does not block settlement.

Provider calls: 0.

Model mutations: 0.

Promotion mutations: 0.

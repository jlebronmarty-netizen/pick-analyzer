# Platform Rollback Runbook

Certified runtime commit: 94159038571ba16cf31107403efce3af7f13ba50

Certified Git tag: v1.0-platform-certified

Production URL: https://pick-analyzer.vercel.app

Repository: https://github.com/jlebronmarty-netizen/pick-analyzer

## Inspect Current Production Version

Check the production version endpoint:

```powershell
Invoke-RestMethod https://pick-analyzer.vercel.app/api/system/version
```

Expected certified runtime lineage:

```text
gitCommit = 94159038571ba16cf31107403efce3af7f13ba50
```

## Compare Production With Baseline

Inspect local and remote Git state:

```powershell
git rev-parse HEAD
git rev-parse origin/main
git tag --points-at HEAD
git show --stat v1.0-platform-certified
```

Compare any candidate rollback target with the certified runtime:

```powershell
git diff --stat 94159038571ba16cf31107403efce3af7f13ba50..HEAD
```

## Safe Git Rollback Options

Preferred option for production rollback is to promote a known-good Vercel deployment for the certified baseline when available. This avoids rewriting Git history.

If a Git revert is required, use a forward-only revert commit against the offending changes:

```powershell
git revert <bad_commit>
npm.cmd run build
git diff --check
```

Avoid destructive history changes such as hard resets on shared branches unless explicitly approved for the exact operation.

## Vercel Rollback Or Deployment Promotion

Use the Vercel dashboard or CLI to inspect deployments for the project `pick-analyzer`.

Rollback options:

- Promote a previous production deployment that served the certified baseline.
- Deploy the certified commit from a clean local checkout.

After promotion or deploy, verify:

```powershell
Invoke-RestMethod https://pick-analyzer.vercel.app/api/system/version
```

## Required Environment Checks

- Confirm production environment variables exist in Vercel before deployment.
- Do not print or copy secrets into logs or documentation.
- Confirm `CRON_SECRET`, Supabase service credentials and provider API keys are present through environment management only.
- Confirm scheduler ownership remains GitHub Actions for write-capable operating-day execution.

## Database Migration Warning

The certified rollback baseline does not require a database migration. Do not run destructive migrations as part of rollback. If a later release introduced migrations, analyze whether schema rollback is safe before promoting older code.

## Cache Revalidation

After rollback or deployment, clear supported caches:

```powershell
Invoke-RestMethod -Method Post https://pick-analyzer.vercel.app/api/dashboard/cache/clear
```

Use only supported cache-clear endpoints. Do not create ad hoc production cache mutation paths during rollback.

## Scheduler Verification

Verify scheduler ownership and operating-day status:

```powershell
Invoke-RestMethod https://pick-analyzer.vercel.app/api/operations/status
Invoke-RestMethod https://pick-analyzer.vercel.app/api/operating-day/automation/status
```

Expected certified ownership:

- Write-capable scheduler: GitHub Actions production operating-day scheduler.
- Disabled duplicate owner: Vercel operating-day cron.
- Provider budget enforcement: application provider budget service.

## Post-Rollback Smoke Tests

Run these checks after any rollback or deployment promotion:

- `/api/system/version`
- `/api/operations/status`
- `/api/operations/validation`
- `/api/dashboard?mode=today&includeValidation=true`
- `/api/current-board?includeValidation=true`
- `/api/market-opportunities/most-likely`
- `/api/market-opportunities/best-value`
- `/api/predictions/settle?dryRun=true`
- `/api/performance`
- `/api/performance/goals`
- `/api/performance/validation`

Required post-rollback state:

- Production reports the intended Git commit.
- Operations status does not contain false odds blockers.
- Operations validation has no true failures.
- Dashboard and Current Board validation pass.
- Settlement dry-run performs zero mutations.
- Performance renders sanitized user labels and retains raw codes only in Internal Diagnostics.

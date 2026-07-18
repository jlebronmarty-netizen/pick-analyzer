# Vercel Deployment Recovery

## Cron Correction

The previous `vercel.json` used an hourly cron that Vercel Hobby rejects. The repository now uses one consolidated daily cron entry:

```json
{
  "crons": [
    {
      "path": "/api/cron/operating-day",
      "schedule": "0 12 * * *"
    }
  ]
}
```

The scheduler route determines the due MLB operating-day action internally. `0 12 * * *` is approximately 8:00 AM in America/Puerto_Rico, which does not observe daylight saving time.

## External Scheduler Fallback

`.github/workflows/operating-day-refresh.yml` provides multiple daily scheduler-ready calls for morning, midday, afternoon and pregame/check windows. It requires repository secrets named `PICK_ANALYZER_BASE_URL` and `PICK_ANALYZER_CRON_SECRET`, calls `/api/cron/operating-day?dryRun=false`, fails visibly on non-2xx responses and supports manual `workflow_dispatch`.

GitHub scheduled workflows may run late. Treat the workflow as external scheduler readiness until those secrets are configured and the workflow is pushed.

## Required Environment Variable Names

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `SPORTSDATAIO_MLB_API_KEY`
- `SPORTSDATAIO_DAILY_CALL_BUDGET`
- `SPORTSDATAIO_SOFT_RESERVE`
- `SPORTSDATAIO_MAX_CALLS_PER_ACTION`
- `NEXT_PUBLIC_APP_VERSION`
- `NEXT_PUBLIC_BUILD_TIMESTAMP`
- `NEXT_PUBLIC_STATIC_PAGE_COUNT`

Do not expose secret values in logs, docs or client responses.

## Verification Routes

- `/api/system/version`
- `/api/operating-day/validation`
- `/api/slate/next/status?sportKey=baseball_mlb`
- `/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb`
- `/dashboard`

## Deployment Notes

`npm.cmd run build` must pass before deployment. If `npx vercel --prod` is unavailable due to local auth/project-link/network state, run it from the linked project shell after verifying the environment variables above.

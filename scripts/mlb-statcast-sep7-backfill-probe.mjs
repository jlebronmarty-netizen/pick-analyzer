const { refreshMlbStatcastDaily } = await import('../src/services/mlb-statcast-daily-refresh.service.ts')

try {
  const result = await refreshMlbStatcastDaily({ date: '2026-09-07' })
  console.log(`MLB_STATCAST_SEP7_BACKFILL=${JSON.stringify({
    success: result.success,
    status: result.status,
    targetDate: result.targetDate,
    sourceRows: result.sourceRows ?? null,
    sourceGames: result.sourceGames ?? null,
    inserted: result.inserted ?? null,
    reuses: result.reuses ?? null,
    conflicts: result.conflicts ?? null,
    unexpectedExisting: result.unexpectedExisting ?? null,
    analyticsRefreshed: result.analyticsRefreshed ?? false,
    coverage: result.coverage ?? null,
  })}`)
  if (!result.success) process.exitCode = 1
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.error(`MLB_STATCAST_SEP7_BACKFILL_ERROR=${message}`)
  process.exitCode = 1
}

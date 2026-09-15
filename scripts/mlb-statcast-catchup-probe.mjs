const { refreshMlbStatcastDaily } = await import('../src/services/mlb-statcast-daily-refresh.service.ts')

const dates = ['2026-09-13', '2026-09-14']
const results = []

try {
  for (const date of dates) {
    const result = await refreshMlbStatcastDaily({ date })
    results.push({
      date,
      success: result.success,
      status: result.status,
      targetDate: result.targetDate ?? date,
      sourceRows: result.sourceRows ?? null,
      sourceGames: result.sourceGames ?? null,
      inserted: result.inserted ?? null,
      reuses: result.reuses ?? null,
      conflicts: result.conflicts ?? null,
      unexpectedExisting: result.unexpectedExisting ?? null,
      analyticsRefreshed: result.analyticsRefreshed ?? false,
      coverage: result.coverage ?? null,
    })
    if (!result.success) throw new Error(`STATCAST_CATCHUP_FAILED:${date}:${result.status}`)
  }
  console.log(`MLB_STATCAST_CATCHUP=${JSON.stringify({ success: true, results })}`)
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.error(`MLB_STATCAST_CATCHUP_ERROR=${message}`)
  console.error(`MLB_STATCAST_CATCHUP_PARTIAL=${JSON.stringify(results)}`)
  process.exitCode = 1
}

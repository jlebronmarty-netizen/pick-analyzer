const { materializePa14V2RealBazRow } = await import('../src/services/pa14-v2-real-evidence.service.ts')

try {
  const result = await materializePa14V2RealBazRow()
  const row = result.result?.status === 'ELIGIBLE' ? result.result.row : null
  console.log(`PA14_V2_REAL_ROW_SUMMARY=${JSON.stringify({
    status: result.result?.status ?? null,
    reasons: result.result?.status === 'BLOCKED' ? result.result.reasons : [],
    replayMatch: result.replayMatch,
    oracleMatch: result.oracleMatch,
    certificationCandidate: result.certificationCandidate,
    contractVersion: row?.contractVersion ?? null,
    builderVersion: row?.builderVersion ?? result.audit?.builderVersion ?? null,
    lineageDigest: row?.lineageDigest ?? null,
    dataAsOf: row?.dataAsOf ?? null,
    cutoff: row?.cutoff ?? result.target?.cutoff ?? null,
    features: row?.features ?? null,
    statistics: row?.statistics ?? null,
    startCount: result.audit?.startCount ?? null,
    opponentGameCount: result.audit?.opponentGameCount ?? null,
    maxHistoricalCompletion: result.audit?.maxHistoricalCompletion ?? null,
    censusDigest: result.audit?.censusDigest ?? null,
  })}`)
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.error(`PA14_V2_REAL_ROW_PROBE_ERROR=${message}`)
  process.exitCode = 1
}

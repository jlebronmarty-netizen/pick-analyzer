const sportArg = process.argv.find((arg) => arg.startsWith('--sport='))?.split('=')[1] ?? 'both'

const service = await import('../src/services/stored-preview-prediction-lifecycle.service.ts')

const runners = {
  nfl: service.runNflStoredPreviewPredictionLifecycle,
  nhl: service.runNhlStoredPreviewPredictionLifecycle,
}

const selected = sportArg === 'both' ? ['nfl', 'nhl'] : [sportArg]
const results = []

for (const sport of selected) {
  const run = runners[sport]
  if (!run) throw new Error(`Unsupported sport: ${sport}`)
  const result = await run({ limitEvents: 12 })
  const checks = [
    ['success', result.success === true],
    ['no provider calls', result.providerCallsMade === 0],
    ['dry-run remote mutations zero', result.remoteMutationsMade === 0],
    ['canonical events available', result.lifecycle.canonicalEvents === true],
    ['pregame features available', result.lifecycle.pregameFeatures === true],
    ['pregame predictions available', result.lifecycle.pregamePredictions === true],
    ['no retrospective predictions', result.safety.noRetrospectivePredictions === true],
    ['no post-start leakage', result.safety.noPostStartLeakage === true],
    ['preview isolation', result.safety.previewIsolation === true],
    ['no production pollution', result.safety.noProductionPollution === true],
    ['no fake readiness', result.safety.noFakeReadiness === true],
    ['moneyline supported', result.summary.markets.includes('moneyline')],
    ['spread supported', result.summary.markets.includes('spread')],
    ['total supported', result.summary.markets.includes('total')],
    ['production eligible rows zero', result.summary.productionEligibleRows === 0],
    ['official picks zero', result.summary.officialPicks === 0],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  results.push({
    sport,
    success: failed.length === 0,
    checks: checks.length,
    passed: checks.length - failed.length,
    failed,
    summary: result.summary,
    lifecycle: result.lifecycle,
    settlementDryRun: result.settlementDryRun,
  })
}

const failedSports = results.filter((result) => !result.success)
const report = {
  success: failedSports.length === 0,
  mode: 'nfl_nhl_preview_lifecycle_validation_v1',
  generatedAt: new Date().toISOString(),
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  results,
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exit(1)

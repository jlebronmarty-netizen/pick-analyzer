import fs from 'node:fs'

const envPath = '.env.local'
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const servicePath = 'src/services/adaptive-refresh-orchestrator.service.ts'
const service = fs.readFileSync(servicePath, 'utf8')
const { validateResultEvidenceReconciliationFixtures } = await import('../src/services/adaptive-refresh-orchestrator.service.ts')

const fixtures = validateResultEvidenceReconciliationFixtures()
const checks = [
  {
    name: 'deterministic result-evidence fixtures pass',
    pass: fixtures.success === true,
  },
  {
    name: 'settlement backlog reads canonical game_results evidence',
    pass: service.includes(".from('game_results')") && service.includes(".in('game_id', eventIds.slice(index, index + 100))"),
  },
  {
    name: 'completed sport_events alone are not used as ready backlog evidence',
    pass:
      service.includes('isAuthoritativeSettlementResult') &&
      !service.includes('const eligible = pending.filter((row) => isFinalScoredEvent'),
  },
  {
    name: 'game_result evidence requires canonical game id and complete score',
    pass: service.includes('result.game_id && result.home_score !== null && result.away_score !== null'),
  },
  {
    name: 'result readiness remains read-only and provider-free',
    pass: service.includes('providerCallsMade: 0') && service.includes('remoteMutationsMade: 0'),
  },
]

const failed = checks.filter((check) => !check.pass)
for (const check of checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`)
console.log(JSON.stringify({ fixtures }, null, 2))

if (failed.length > 0) {
  console.error(`MLB result evidence reconciliation validation failed: ${failed.map((check) => check.name).join(', ')}`)
  process.exit(1)
}

console.log(`MLB result evidence reconciliation validation passed: ${checks.length}/${checks.length}`)

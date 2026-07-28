import fs from 'node:fs'

const servicePath = 'src/services/operating-day.service.ts'
const service = fs.readFileSync(servicePath, 'utf8')
const closureScript = fs.readFileSync('scripts/mlb-canonical-settlement-backlog-closure-v1.mjs', 'utf8')
const settleBranch = service.match(/action === 'settle'[\s\S]*?} else if \(action === 'replay'\)/)?.[0] ?? ''

const checks = [
  {
    name: 'operating-day settlement reads canonical game_results',
    pass:
      service.includes("from('game_results')") &&
      service.includes(".in('game_id', eventIds)") &&
      service.includes('const resultByGame = new Map(results.map((result) => [result.game_id, result]))'),
  },
  {
    name: 'unresolved predictions are skipped instead of forced',
    pass:
      service.includes('if (!result)') &&
      service.includes('summary.unresolved += 1') &&
      service.includes('continue'),
  },
  {
    name: 'settlement supports moneyline spread and total only',
    pass:
      service.includes("if (market === 'moneyline')") &&
      service.includes("if (market === 'spread')") &&
      service.includes("if (market === 'total')"),
  },
  {
    name: 'settlement persists stake used for profit accounting',
    pass:
      service.includes('stake,') &&
      service.includes('stake: update.stake') &&
      service.includes('profit: update.profit'),
  },
  {
    name: 'settlement path does not run model learning',
    pass:
      Boolean(settleBranch) && !settleBranch.includes('runModelLearning'),
  },
  {
    name: 'closure runner processes bounded oldest-ready dates',
    pass:
      closureScript.includes('MAX_BATCHES') &&
      closureScript.includes('readyByDate.slice(0, MAX_BATCHES)') &&
      closureScript.includes('sort(([a], [b]) => a.localeCompare(b))'),
  },
  {
    name: 'closure runner excludes unresolved rows from settlement',
    pass:
      closureScript.includes('completeResult && supportedMarket && cutoffSafe') &&
      closureScript.includes('awaiting.push(base)') &&
      closureScript.includes('Number(idempotency.eligible ?? 0) !== 0'),
  },
  {
    name: 'learning evidence remains derived without weight mutation',
    pass:
      closureScript.includes('prediction_history_settlement_derived_read_only_queue_v1') &&
      closureScript.includes('getAiLearningLifecycle') &&
      !closureScript.includes('runModelLearning'),
  },
  {
    name: 'learning evidence idempotency uses deterministic keys',
    pass:
      closureScript.includes('duplicateDeterministicKeys') &&
      closureScript.includes('new Set(deterministicKeys).size'),
  },
]

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`)
}

const failed = checks.filter((check) => !check.pass)

if (failed.length > 0) {
  console.error(`Protected canonical MLB settlement validation failed: ${failed.map((check) => check.name).join(', ')}`)
  process.exit(1)
}

console.log(`Protected canonical MLB settlement validation passed: ${checks.length}/${checks.length}`)

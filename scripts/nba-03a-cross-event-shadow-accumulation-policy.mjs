import fs from 'node:fs'
import path from 'node:path'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const raw = trimmed.slice(index + 1).trim()
    if (!key || process.env[key]) continue
    process.env[key] = raw.replace(/^['"]|['"]$/g, '')
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'))

const {
  runNbaCurrentEraShadowCanary,
  selectNbaCurrentEraShadowAccumulationBatch,
} = await import('../src/services/nba-current-era-shadow-canary.service.ts')
const { generateNbaPredictions } = await import('../src/services/nba-prediction-engine.service.ts')

function modelIdentity(candidate) {
  return [
    candidate.eventId,
    candidate.market ?? '',
    candidate.selection ?? '',
    candidate.line ?? 'null',
    candidate.modelVersion,
  ].join('|')
}

function eventMarket(candidate) {
  return [candidate.eventId, candidate.market ?? ''].join('|')
}

function countBy(items, keyFn) {
  return Object.fromEntries(
    Array.from(
      items.reduce((map, item) => map.set(keyFn(item), (map.get(keyFn(item)) ?? 0) + 1), new Map()).entries()
    ).sort(([left], [right]) => String(left).localeCompare(String(right)))
  )
}

function concentration(items) {
  const byEvent = countBy(items, (item) => item.eventId)
  const byEventMarket = countBy(items, eventMarket)
  const byModel = countBy(items, modelIdentity)
  const max = (values) => values.length ? Math.max(...values) : 0
  return {
    rows: items.length,
    uniqueEvents: Object.keys(byEvent).length,
    uniqueModelIdentities: Object.keys(byModel).length,
    sportsbookVariants: items.length - Object.keys(byModel).length,
    largestEventShare: items.length ? Number((max(Object.values(byEvent)) / items.length).toFixed(2)) : 0,
    largestEventMarketShare: items.length ? Number((max(Object.values(byEventMarket)) / items.length).toFixed(2)) : 0,
    averageRowsPerEvent: Object.keys(byEvent).length ? Number((items.length / Object.keys(byEvent).length).toFixed(2)) : 0,
  }
}

function summarize(items) {
  const byModel = countBy(items, modelIdentity)
  return {
    rows: items.length,
    uniqueEvents: Object.keys(countBy(items, (item) => item.eventId)).length,
    rowsPerEvent: countBy(items, (item) => item.eventId),
    rowsPerMarket: countBy(items, (item) => item.market ?? 'unknown'),
    rowsPerSportsbook: countBy(items, (item) => item.sportsbook ?? 'unknown'),
    uniqueModelPredictionIdentities: Object.keys(byModel).length,
    sportsbookVariantsPerModelIdentity: byModel,
    concentration: concentration(items),
  }
}

function publicCandidate(candidate, predictionByKey) {
  const prediction = predictionByKey.get(candidate.modelMatchKey)
  return {
    candidateKey: candidate.candidateKey,
    eventId: candidate.eventId,
    market: candidate.market,
    selection: candidate.selection,
    line: candidate.line,
    sportsbook: candidate.sportsbook,
    odds: candidate.price,
    probability: prediction?.modelProbability ?? null,
    confidence: prediction?.confidence ?? null,
    oddsTimestamp: candidate.oddsTimestamp,
    priceAgeMinutes: candidate.priceAgeMinutes,
  }
}

const result = await runNbaCurrentEraShadowCanary({ mode: 'dry-run', limit: 25 })
const modelResult = await generateNbaPredictions({ persist: false, limit: 25 })
const slug = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9.+-]+/g, '_').replace(/^_+|_+$/g, '')
const predictionByKey = new Map(modelResult.predictions.map((prediction) => ([
  [
    'basketball_nba',
    prediction.gameId,
    prediction.market,
    slug(prediction.team),
    prediction.line ?? 'null',
    prediction.modelVersion,
  ].join('|'),
  prediction,
])))
const eligible = result.candidates.filter((candidate) => candidate.writeEligible)
const simulations = {}

for (const size of [10, 25, 50]) {
  const oldSelection = eligible.slice(0, size)
  const policySelection = selectNbaCurrentEraShadowAccumulationBatch({ candidates: result.candidates, batchSize: size })
  simulations[size] = {
    old: summarize(oldSelection),
    proposed: summarize(policySelection.selected),
    policy: policySelection.policy,
    proposedCandidates: policySelection.selected.map((candidate) => publicCandidate(candidate, predictionByKey)),
  }
}

console.log(JSON.stringify({
  status: 'NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_DRY_RUN',
  generatedAt: result.generatedAt,
  providerCalls: result.providerCalls,
  databaseMutationsFromDryRun: result.databaseMutationsFromDryRun,
  dryRun: {
    eventsScanned: result.eventsScanned,
    priceCandidates: result.candidates.length,
    priceEligible: result.candidates.filter((candidate) => candidate.priceEligible).length,
    modelMatched: result.candidates.filter((candidate) => candidate.modelMatched).length,
    writeEligible: result.eligible,
    skipped: result.skipped,
    skipReasons: result.skipReasons,
    rowsBefore: result.rowsBefore,
    rowsAfter: result.rowsAfter,
  },
  simulations,
}, null, 2))

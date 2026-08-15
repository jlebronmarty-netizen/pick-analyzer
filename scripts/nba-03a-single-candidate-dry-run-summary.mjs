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

const { runNbaCurrentEraShadowCanary } = await import('../src/services/nba-current-era-shadow-canary.service.ts')

const result = await runNbaCurrentEraShadowCanary({ mode: 'dry-run', limit: 25 })
const firstWriteEligible = result.candidates.find((candidate) => candidate.writeEligible) ?? null
const priceEligible = result.candidates.filter((candidate) => candidate.priceEligible).length
const modelMatched = result.candidates.filter((candidate) => candidate.modelMatched).length

console.log(JSON.stringify({
  success: result.success,
  generatedAt: result.generatedAt,
  classification: result.classification,
  eventsScanned: result.eventsScanned,
  priceCandidates: result.candidates.length,
  priceEligible,
  modelMatched,
  writeEligible: result.eligible,
  skipped: result.skipped,
  skipReasons: result.skipReasons,
  rowsBefore: result.rowsBefore,
  rowsAfter: result.rowsAfter,
  inserted: result.inserted,
  providerCalls: result.providerCalls,
  databaseMutationsFromDryRun: result.databaseMutationsFromDryRun,
  firstWriteEligible: firstWriteEligible
    ? {
        candidateKey: firstWriteEligible.candidateKey,
        eventId: firstWriteEligible.eventId,
        market: firstWriteEligible.market,
        selection: firstWriteEligible.selection,
        line: firstWriteEligible.line,
        sportsbook: firstWriteEligible.sportsbook,
        price: firstWriteEligible.price,
        oddsTimestamp: firstWriteEligible.oddsTimestamp,
        priceAgeMinutes: firstWriteEligible.priceAgeMinutes,
        modelMatchKey: firstWriteEligible.modelMatchKey,
      }
    : null,
}, null, 2))

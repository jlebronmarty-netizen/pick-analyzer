import fs from 'node:fs'

function loadEnvFile(path = '.env.local') {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim().replace(/^['"]|['"]$/g, '')
    if (key && !process.env[key]) process.env[key] = value
  }
}

loadEnvFile()

const { getMlbContextLineage } = await import('../src/services/mlb-context-lineage.service.ts')

const date = process.argv.find((arg) => arg.startsWith('--date='))?.slice('--date='.length)
const eventId = process.argv.find((arg) => arg.startsWith('--eventId='))?.slice('--eventId='.length)
const snapshotType = process.argv.find((arg) => arg.startsWith('--snapshotType='))?.slice('--snapshotType='.length)
const allowProviderCalls = process.argv.includes('--allow-provider-calls')
const persist = process.argv.includes('--persist')
const summaryOnly = process.argv.includes('--summary')

const result = await getMlbContextLineage({
  date,
  eventId,
  snapshotType,
  allowProviderCalls,
  persist,
})

const output = summaryOnly
  ? {
      success: result.success,
      mode: result.mode,
      generatedAt: result.generatedAt,
      selectedDate: result.selectedDate,
      snapshotType: result.snapshotType,
      persisted: result.persisted,
      providerCallsMade: result.providerCallsMade,
      remoteMutationsMade: result.remoteMutationsMade,
      sourceAudit: result.sourceAudit,
      certifications: result.certifications,
      summary: result.summary,
      persistence: result.persistence,
    }
  : result

console.log(JSON.stringify(output, null, 2))

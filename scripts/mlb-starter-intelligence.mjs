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

const { getMlbStarterIntelligence } = await import('../src/services/mlb-starter-intelligence.service.ts')

const dateArg = process.argv.find((arg) => arg.startsWith('--date='))?.slice('--date='.length)
const summaryOnly = process.argv.includes('--summary')
const result = await getMlbStarterIntelligence({ date: dateArg })

console.log(JSON.stringify(summaryOnly
  ? {
      success: result.success,
      mode: result.mode,
      generatedAt: result.generatedAt,
      selectedDate: result.selectedDate,
      providerCallsMade: result.providerCallsMade,
      remoteMutationsMade: result.remoteMutationsMade,
      sourceAudit: result.sourceAudit,
      summary: result.summary,
      diagnostics: result.diagnostics,
      certifications: result.certifications,
    }
  : result, null, 2))

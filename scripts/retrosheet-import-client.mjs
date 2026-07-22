import fs from 'fs'

function loadEnvLocal() {
  const text = fs.readFileSync('.env.local', 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] ??= value
  }
}

const mode = process.argv[2] ?? 'dry_run'
const port = process.argv[3] ?? '3055'
loadEnvLocal()

const response = await fetch(`http://127.0.0.1:${port}/api/mlb/historical-intelligence/retrosheet/import`, {
  method: 'POST',
  signal: AbortSignal.timeout(30 * 60 * 1000),
  headers: {
    'content-type': 'application/json',
    'x-cron-secret': process.env.CRON_SECRET ?? '',
  },
  body: JSON.stringify({ mode }),
})

const body = await response.json()
const summary = {
  httpStatus: response.status,
  success: body.success,
  operation: body.operation,
  importIdPresent: Boolean(body.importId),
  providerCallsMade: body.providerCallsMade,
  productionMutationsMade: body.productionMutationsMade,
  historicalMutationsMade: body.historicalMutationsMade,
  planned: body.planned,
  validation: body.validation,
  beforeCounts: body.beforeCounts,
  afterCounts: body.afterCounts,
  writes: body.writes,
  warnings: body.warnings,
  errors: body.errors,
  durationMs: body.durationMs,
}

console.log(JSON.stringify(summary, null, 2))

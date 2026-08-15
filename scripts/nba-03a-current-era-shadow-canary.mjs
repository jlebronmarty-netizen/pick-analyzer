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

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))
const mode = modeArg ? modeArg.split('=')[1] : 'dry-run'
const candidateKeyArg = process.argv.find((arg) => arg.startsWith('--candidate-key='))
const candidateKey = candidateKeyArg ? candidateKeyArg.slice('--candidate-key='.length) : null

if (!['dry-run', 'write-one'].includes(mode)) {
  console.error(JSON.stringify({ success: false, error: 'Invalid mode. Use --mode=dry-run or --mode=write-one.' }, null, 2))
  process.exit(1)
}

if (mode === 'write-one' && !candidateKey) {
  console.error(
    JSON.stringify(
      {
        success: false,
        mode,
        error: 'WRITE_CARDINALITY_NOT_ONE',
        message: 'write-one mode requires --candidate-key=<stable Safe Canary candidate key>.',
      },
      null,
      2
    )
  )
  process.exit(2)
}

if (mode === 'write-one' && process.env.NBA_CURRENT_ERA_SHADOW_WRITE_AUTHORIZED !== 'true') {
  console.error(
    JSON.stringify(
      {
        success: false,
        mode,
        error: 'SAFE_WRITER_NOT_AUTHORIZED',
        message:
          'Write mode requires explicit NBA_CURRENT_ERA_SHADOW_WRITE_AUTHORIZED=true and all runtime gates to pass.',
      },
      null,
      2
    )
  )
  process.exit(2)
}

const { runNbaCurrentEraShadowCanary } = await import('../src/services/nba-current-era-shadow-canary.service.ts')

const result = await runNbaCurrentEraShadowCanary({ mode, candidateKey })
console.log(JSON.stringify(result, null, 2))

if (!result.success) process.exit(1)

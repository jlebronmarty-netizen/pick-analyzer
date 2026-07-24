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

function argValue(name, fallback = null) {
  const prefix = `--${name}=`
  const item = process.argv.find((value) => value.startsWith(prefix))
  return item ? item.slice(prefix.length) : fallback
}

loadEnvFile()

const { runHistoricalReplayPilot, getHistoricalReplayPilotStatus } = await import('../src/services/historical-replay-pilot.service.ts')

const mode = argValue('mode', 'run')
const limit = Number(argValue('limit', '12'))
const dryRun = process.argv.includes('--dry-run')

const result = mode === 'status'
  ? await getHistoricalReplayPilotStatus()
  : await runHistoricalReplayPilot({ limit, dryRun })

console.log(JSON.stringify(result, null, 2))

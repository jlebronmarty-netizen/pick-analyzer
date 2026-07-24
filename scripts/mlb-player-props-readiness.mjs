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

const { getMlbPlayerPropsReadinessAudit } = await import('../src/services/mlb-player-props-readiness-audit.service.ts')

const result = await getMlbPlayerPropsReadinessAudit()

console.log(JSON.stringify(result, null, 2))

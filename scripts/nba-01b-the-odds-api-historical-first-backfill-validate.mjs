import { spawnSync } from 'node:child_process'

const result = spawnSync(
  process.execPath,
  ['scripts/nba-01b-the-odds-api-historical-first-backfill.mjs', '--validate'],
  { stdio: 'inherit' }
)

process.exit(result.status ?? 1)

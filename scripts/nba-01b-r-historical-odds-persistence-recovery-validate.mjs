import { spawnSync } from 'node:child_process'

const result = spawnSync(
  process.execPath,
  ['scripts/nba-01b-r-historical-odds-persistence-recovery.mjs', '--validate'],
  { stdio: 'inherit' },
)

process.exit(result.status ?? 1)

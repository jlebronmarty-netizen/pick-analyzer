import { spawnSync } from 'node:child_process'

const result = spawnSync(
  process.execPath,
  ['--loader', './scripts/local-ts-loader.mjs', 'scripts/nba-01c-balldontlie-goat-prep.mjs', '--validate'],
  { stdio: 'inherit' },
)

process.exit(result.status ?? 1)

import { spawnSync } from 'node:child_process'

const result = spawnSync(
  process.execPath,
  ['--loader', './scripts/local-ts-loader.mjs', 'scripts/nfl-01-balldontlie-historical-import-readiness.mjs', '--validate'],
  { stdio: 'inherit' },
)

process.exit(result.status ?? 1)

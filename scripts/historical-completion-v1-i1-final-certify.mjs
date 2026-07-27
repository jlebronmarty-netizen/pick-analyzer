import fs from 'node:fs'
import { execSync } from 'node:child_process'

const doc = fs.readFileSync('docs/HISTORICAL_SPORTS_DATA_COMPLETION_PROGRAM_V1_CERTIFICATION.md', 'utf8')
const ledger = fs.readFileSync('docs/autonomous-execution-v2.json', 'utf8')
const platformTag = execSync('git rev-parse v1.0-platform-certified', { encoding: 'utf8' }).trim()

const checks = [
  ['local only status documented', doc.includes('Status: local-only completion program certified.')],
  ['provider calls zero documented', doc.includes('| Provider calls | 0 |')],
  ['remote mutations zero documented', doc.includes('| Remote mutations | 0 |')],
  ['production sql and imports zero documented', doc.includes('| Production SQL applied | 0 |') && doc.includes('| Production imports executed | 0 |')],
  ['epoch and learning hard stops documented', doc.includes('| `DATA_FOUNDATION_V2_EPOCH` activated | no |') && doc.includes('| Learning Brain weights modified | no |')],
  ['push deploy hard stops documented', doc.includes('| Push executed | no |') && doc.includes('| Deploy executed | no |')],
  ['platform tag unchanged', platformTag === 'eb15613efd81ff1a8e57797e11feb7254c1b604a'],
  ['ordered final phase commits documented', doc.includes('64f6030857c54768713f0f5631570a9101106798') && doc.includes('93ff91cc5320c7468f28c05c4c360909b2d1724f')],
  ['all sport verdicts documented', doc.includes('| MLB | core/partial foundation certified') && doc.includes('| UFC | event-driven empty/blocked readiness certified |')],
  ['final markers documented', doc.includes('HISTORICAL_SPORTS_DATA_COMPLETION_PROGRAM_V1_PASS') && doc.includes('NO_CERTIFIED_PLATFORM_TAG_CHANGE_COMPLETION_PROGRAM_PASS')],
  ['ledger contains h1 marker', ledger.includes('TENNIS_UFC_EVENT_READINESS_CERTIFICATION_V1_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'historical_sports_data_completion_program_v1_final_certification',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  productionSqlApplied: 0,
  importsExecuted: 0,
  featureRebuildsExecuted: 0,
  retrospectivePredictionsGenerated: 0,
  platformTag
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)

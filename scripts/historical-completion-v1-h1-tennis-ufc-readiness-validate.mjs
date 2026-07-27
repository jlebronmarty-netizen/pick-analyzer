import fs from 'node:fs'

const doc = fs.readFileSync('docs/TENNIS_UFC_EVENT_READINESS_CERTIFICATION_V1.md', 'utf8')

const checks = [
  ['event driven status documented', doc.includes('event-driven empty/blocked readiness certified')],
  ['no team schema forcing documented', doc.includes('must not be forced into team-season schemas')],
  ['tennis and ufc zero baseline documented', doc.includes('| Tennis | 0 | empty/blocked |') && doc.includes('| UFC | 0 | empty/blocked |')],
  ['all tracked datasets zero documented', doc.includes('All tracked datasets for both sports currently have 0 rows')],
  ['tennis manifests documented', doc.includes('tennis_event_registry_v1') && doc.includes('tennis_match_results_v1')],
  ['ufc manifests documented', doc.includes('ufc_event_registry_v1') && doc.includes('ufc_fight_results_v1')],
  ['market identity boundary documented', doc.includes('No market rows without certified event/bout identity.')],
  ['recommendation logic blocked', doc.includes('No player props, alternate lines, live markets, EV, Kelly, staking, Official Picks or Portfolio workflows.')],
  ['zero execution accounting documented', doc.includes('Provider calls: 0') && doc.includes('Imports executed: 0')],
  ['certification markers present', doc.includes('TENNIS_UFC_EVENT_READINESS_CERTIFICATION_V1_PASS') && doc.includes('UFC_EVENT_DRIVEN_NO_TEAM_SCHEMA_FORCE_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'tennis_ufc_event_readiness_certification_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  importsExecuted: 0,
  retrospectivePredictionsGenerated: 0
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)

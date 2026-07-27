import fs from 'node:fs'

const doc = fs.readFileSync('docs/MLB_EVENT_RESULT_COMPLETION_V3.md', 'utf8')

const checks = [
  ['stored partial result state documented', doc.includes('Stored result rows: 471') && doc.includes('not complete result coverage')],
  ['deterministic event identity contract documented', doc.includes('Natural key:') && doc.includes('doubleheader discriminator')],
  ['team date only matching blocked', doc.includes('Team/date-only matching is never enough')],
  ['doubleheader safety documented', doc.includes('Doubleheader detection requires')],
  ['idempotency key documented', doc.includes('mlb_result:{provider}:{provider_event_id}:{final_status}:{home_score}:{away_score}')],
  ['import execution remains blocked', doc.includes('Execution remains blocked until approved')],
  ['no retrospective predictions', doc.includes('Retrospective predictions generated: 0')],
  ['certification markers present', doc.includes('MLB_DOUBLEHEADER_RECONCILIATION_PASS') && doc.includes('MLB_IMPORT_IDEMPOTENCY_V3_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'mlb_event_result_completion_v3_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  blockers: ['production_result_import_requires_separate_approval']
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)

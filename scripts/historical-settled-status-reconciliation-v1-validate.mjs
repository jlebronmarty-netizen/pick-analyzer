import fs from 'node:fs'

const classifier = fs.readFileSync('src/services/canonical-settlement-state.service.ts', 'utf8')
const performance = fs.readFileSync('src/services/performance-scope-v2.service.ts', 'utf8')
const learning = fs.readFileSync('src/services/ai-learning-lifecycle.service.ts', 'utf8')
const scheduler = fs.readFileSync('src/services/adaptive-refresh-orchestrator.service.ts', 'utf8')
const audit = fs.existsSync('docs/historical-settled-status-reconciliation-v1.json')
  ? JSON.parse(fs.readFileSync('docs/historical-settled-status-reconciliation-v1.json', 'utf8'))
  : null

const requiredFixtureLabels = [
  'stored settled + deterministic settled',
  'stored settled without canonical result',
  'stored pending with canonical result',
  'preview/shadow exclusion',
  'unsupported market',
  'legacy compatibility',
  'invalid cutoff',
  'performance inclusion',
  'learning inclusion',
  'scheduler inclusion',
]

const checks = [
  ['fixture validator exists', classifier.includes('validateCanonicalSettlementStateFixtures')],
  ...requiredFixtureLabels.map((label) => [`fixture covers ${label}`, classifier.includes(label)]),
  ['performance scope uses canonical eligibility', performance.includes('canonicalEligibility')],
  ['performance scope uses canonical pending reason', performance.includes('canonicalPendingReason')],
  ['performance scope uses canonical lifecycle badge', performance.includes('canonicalLifecycleBadge')],
  ['learning uses canonical production settled', learning.includes('isCanonicalProductionSettled')],
  ['scheduler pending detection uses canonical stored outcome', scheduler.includes("canonicalStoredOutcome(row) === 'pending'")],
  ['read-only audit evidence exists', Boolean(audit?.success)],
  ['read-only audit reports zero provider calls', audit?.safety?.providerCallsMade === 0],
  ['read-only audit reports zero remote mutations', audit?.safety?.remoteMutationsMade === 0],
  ['read-only audit reports zero settlement writes', audit?.safety?.settlementWrites === 0],
  ['read-only audit reports zero learning writes', audit?.safety?.learningWrites === 0],
  ['read-only audit reports zero model mutations', audit?.safety?.modelWeightMutations === 0],
  ['NFL preview non-regression count preserved', audit?.previewNonRegression?.nflPreviewRows === 776],
  ['NHL preview non-regression count preserved', audit?.previewNonRegression?.nhlPreviewRows === 258],
  ['MLB unresolved rows remain classified not force-settled', audit?.mlb?.byClassification?.STORED_PENDING_CANONICAL_RESULT_MISSING === 48],
]

const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)

console.log(JSON.stringify({
  success: failedChecks.length === 0,
  mode: 'historical_settled_status_reconciliation_v1_validation',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}, null, 2))

if (failedChecks.length) process.exit(1)

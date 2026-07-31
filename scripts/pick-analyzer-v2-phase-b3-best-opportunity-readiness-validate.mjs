import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  panel: 'src/components/dashboard/TodayDecisionPanel.tsx',
  helper: 'src/components/dashboard/today-opportunity-readiness.ts',
  b2Validator: 'scripts/pick-analyzer-v2-phase-b2-today-experience-validate.mjs',
  json: 'docs/pick-analyzer-v2-phase-b3-best-opportunity-readiness.json',
  markdown: 'docs/PICK_ANALYZER_V2_PHASE_B3_BEST_OPPORTUNITY_READINESS.md',
}

const knownUnrelated = [
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
]

function filePath(file) {
  return path.join(ROOT, file)
}

function read(file) {
  return fs.readFileSync(filePath(file), 'utf8')
}

function exists(file) {
  return fs.existsSync(filePath(file))
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

for (const file of Object.values(files)) check(`input exists: ${file}`, exists(file))

const panel = read(files.panel)
const helper = read(files.helper)
const artifact = JSON.parse(read(files.json))
const markdown = read(files.markdown)

check('B3 helper exports normalized contract', helper.includes('export type NormalizedBestOpportunity') && artifact.normalizedBestOpportunityContract.every((field) => helper.includes(field)))
check('source priority is implemented', [
  'sections?.officialPicks?.data?.[0]',
  'bestAvailableValue',
  'highestRankedPricedMarket',
  'mostLikelySummary',
  'highestProjectedOutcome',
  'groundedOpportunities',
].every((text) => helper.includes(text)))
check('readiness states are explicit', artifact.readinessGateStates.every((state) => helper.includes(`'${state}'`)))
check('required readiness gates are present', artifact.readinessGates.every((gate) => helper.includes(`'${gate}'`)))
check('not available is not counted as pass', /row\.state !== 'NOT_APPLICABLE'\s*&& row\.state !== 'NOT_AVAILABLE'/.test(helper) && markdown.includes('NOT_AVAILABLE` is reported separately and never counted as a pass'))
check('plain blocker mapping exists', helper.includes('function hasBlocker') && helper.includes('plainBlocker') && helper.includes('Confidence is below the existing Official Pick threshold'))
check('Today panel consumes normalizer and readiness helper', panel.includes('normalizeBestOpportunity(data)') && panel.includes('buildOfficialPickReadiness(normalizedOpportunity)'))
check('B3 page marker exists', panel.includes('data-b3-best-opportunity-readiness="true"'))
check('probability versus implied graphic exists', panel.includes('Probability vs Implied') && panel.includes('Both probabilities are required before this comparison is shown'))
check('edge EV graphic does not coerce missing to zero', panel.includes('Missing values stay unavailable and are never treated as zero') && !/signedPct\(opportunity\.(edge|expectedValue) \?\? 0\)/.test(panel))
check('freshness data quality graphic exists', panel.includes('Freshness / Quality') && panel.includes('dataQualityStatus'))
check('readiness rows are expandable', panel.includes('<details') && panel.includes('data-b3-readiness-gates="true"'))
check('B2 compatibility markers remain', ['data-b2-today-shell', 'data-b2-best-opportunity', 'data-b2-conviction-shell', 'data-b2-actionability-shell', 'data-b2-readiness-shell'].every((marker) => panel.includes(marker)))
check('Today still uses existing dashboard API only', panel.includes("fetch('/api/dashboard/today'") && !panel.includes("fetch('/api/market-opportunities"))
check('no provider imports in B3 files', !/from ['"]@\/services\/.*provider|from ['"]@\/services\/.*odds-api/i.test(panel + helper))
check('no mutation route fetch in B3 panel', !/fetch\([^)]*(execute|generate|settle|sync|cron|refresh|cache\/clear)/i.test(panel))
check('no recommendation thresholds introduced in UI', !/(minimumOfficial|minimumConfidence|minimumEdge|minimumEv|RECOMMENDATION_THRESHOLDS)/.test(panel + helper))
check('artifact documents no API or service contract change', artifact.todayIntegration?.apiContractChanged === false && artifact.todayIntegration?.serviceContractChanged === false)
check('artifact documents no provider calls or mutations', artifact.safety?.providerCallsMade === 0 && artifact.safety?.databaseMutations === 0 && artifact.safety?.predictionWrites === 0)
check('markdown documents deferred B4-B8 work', ['B4', 'B5', 'B6', 'B7', 'B8'].every((phase) => markdown.includes(`${phase}:`)))

const staged = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
check('unrelated dirty files are not staged', knownUnrelated.every((file) => !staged.includes(file)), staged.join(', '))

const result = {
  generatedAt: new Date().toISOString(),
  baselineCommit: artifact.baselineCommit,
  verdict: checks.every((item) => item.passed)
    ? 'PICK_ANALYZER_V2_PHASE_B3_BEST_OPPORTUNITY_READINESS_PASS'
    : 'PICK_ANALYZER_V2_PHASE_B3_BEST_OPPORTUNITY_READINESS_FAIL',
  checks: checks.length,
  passed: checks.filter((item) => item.passed).length,
  failed: checks.filter((item) => !item.passed).length,
  failedChecks: checks.filter((item) => !item.passed),
  safety: artifact.safety,
}

console.log(JSON.stringify(result, null, 2))
if (!checks.every((item) => item.passed)) process.exit(1)

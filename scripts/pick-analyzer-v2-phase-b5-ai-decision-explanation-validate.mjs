import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  panel: 'src/components/dashboard/TodayDecisionPanel.tsx',
  helper: 'src/components/dashboard/today-ai-decision-presentation.ts',
  readinessHelper: 'src/components/dashboard/today-opportunity-readiness.ts',
  shell: 'src/components/dashboard/DashboardShell.tsx',
  json: 'docs/pick-analyzer-v2-phase-b5-ai-decision-explanation.json',
  markdown: 'docs/PICK_ANALYZER_V2_PHASE_B5_AI_DECISION_EXPLANATION.md',
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

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

for (const file of Object.values(files)) check(`input exists: ${file}`, fs.existsSync(filePath(file)))

const panel = read(files.panel)
const helper = read(files.helper)
const artifact = JSON.parse(read(files.json))
const markdown = read(files.markdown)

check('presentation helper exports required contract', [
  'AiDecisionExplanation',
  'AiConvictionPresentation',
  'ActionabilityPresentation',
  'ChangeCondition',
  'buildAiDecisionPresentation',
].every((text) => helper.includes(text)))
check('conviction labels restricted', artifact.allowedConvictionLabels.every((label) => helper.includes(`'${label}'`)) && !/ConvictionLabel = .*number/i.test(helper))
check('actionability states restricted', artifact.allowedActionabilityStates.every((state) => helper.includes(`'${state}'`)) && !/ActionabilityState = .*number/i.test(helper))
check('no visible numeric conviction or actionability score', !new RegExp('convictionScore|actionabilityScore|score\\s*/\\s*10|0-10|1-10', 'i').test(panel + helper))
check('no hidden weighted score', !new RegExp('weight|weighted|points|sum\\(|reduce\\([^)]*score', 'i').test(helper))
check('no new model or official threshold constants', !/(minimumOfficial|minimumConfidence|minimumEdge|minimumEv|RECOMMENDATION_THRESHOLDS|OFFICIAL_THRESHOLD|MODEL_WEIGHT)/.test(panel + helper))
check('unsupported markets cannot be high or actionable', helper.indexOf('unsupportedMarket(readiness) || negativeValue(opportunity)') < helper.indexOf("label: 'AVOID'") && helper.includes("state: 'DO NOT ACT'"))
check('no official pick means actionability cannot act now', helper.includes('if (opportunity.officialPick)') && helper.indexOf("state: 'ACT NOW'") > helper.indexOf('if (opportunity.officialPick)'))
check('stale evidence cannot act now', helper.indexOf('staleEvidence(opportunity, readiness, freshnessStatus)') < helper.indexOf("state: 'WAIT'") && helper.indexOf("state: 'WAIT'") < helper.indexOf("state: 'ACT NOW'"))
check('negative EV or edge cannot produce high', helper.includes('negativeValue(opportunity)') && helper.indexOf('negativeValue(opportunity)') < helper.indexOf("label: 'AVOID'"))
check('missing evidence does not become pass', helper.includes("label: 'UNAVAILABLE'") && helper.includes("state: 'UNAVAILABLE'") && helper.includes('missingCoreEvidence'))
check('change conditions use conditional language', ['could improve', 'could allow', 'could move', 'would weaken'].every((text) => helper.includes(text)))
check('change conditions do not promise official status', helper.includes('This does not promise Official Pick status') && !/will become (an )?Official Pick/i.test(helper + markdown))
check('Today page consumes B5 helper', panel.includes('buildAiDecisionPresentation') && panel.includes('data-b5-conviction-card="true"') && panel.includes('data-b5-actionability-card="true"') && panel.includes('data-b5-change-mind="true"'))
check('AI explanation concise sections exist', panel.includes('data-b5-ai-explanation="true"') && panel.includes('Decision summary') && panel.includes('compactCards(reasons.why'))
check('B2/B3/B4 markers remain', ['data-b2-today-shell', 'data-b2-conviction-shell', 'data-b2-actionability-shell', 'data-b3-best-opportunity-readiness', 'data-b4-decision-cockpit'].every((marker) => panel.includes(marker)))
check('Advanced Evidence remains collapsed outside Today', read(files.shell).includes('data-b4-mobile-bottom-nav="true"') && fs.existsSync(filePath('src/components/dashboard/AdvancedEvidenceDisclosure.tsx')))
check('no provider imports or mutation fetches', !/from ['"]@\/services\/.*provider|from ['"]@\/services\/.*odds-api/i.test(panel + helper) && !/fetch\([^)]*(execute|generate|settle|sync|cron|refresh|cache\/clear)/i.test(panel))
check('artifact records zero calls and mutations', artifact.safety?.providerCallsIntroduced === 0 && artifact.safety?.externalAiApiCalls === 0 && artifact.safety?.databaseMutations === 0)
check('deferred B6-B8 only', ['B6', 'B7', 'B8'].every((phase) => Object.hasOwn(artifact.deferredWork, phase)) && !Object.hasOwn(artifact.deferredWork, 'B9'))

const staged = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
check('unrelated dirty files are not staged', knownUnrelated.every((file) => !staged.includes(file)), staged.join(', '))

const result = {
  generatedAt: new Date().toISOString(),
  baselineCommit: artifact.baselineCommit,
  verdict: checks.every((item) => item.passed)
    ? 'PICK_ANALYZER_V2_PHASE_B5_AI_DECISION_EXPLANATION_PASS'
    : 'PICK_ANALYZER_V2_PHASE_B5_AI_DECISION_EXPLANATION_FAIL',
  checks: checks.length,
  passed: checks.filter((item) => item.passed).length,
  failed: checks.filter((item) => !item.passed).length,
  failedChecks: checks.filter((item) => !item.passed),
  safety: artifact.safety,
}

console.log(JSON.stringify(result, null, 2))
if (!checks.every((item) => item.passed)) process.exit(1)

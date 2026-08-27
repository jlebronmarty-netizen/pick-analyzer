import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function countNamedFiles(dir, fileName) {
  let count = 0
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) count += countNamedFiles(full, fileName)
    if (entry.isFile() && entry.name === fileName) count += 1
  }
  return count
}

const failures = []
function check(name, condition) {
  if (!condition) failures.push(name)
}

const artifact = JSON.parse(read('docs/CERTIFICATION/pick-2-reset-03-ui-simplification.json'))
const shell = read('src/components/dashboard/DashboardShell.tsx')
const surface = read('src/components/pick2/Pick2Surface.tsx')
const rootPage = read('src/app/page.tsx')
const todayPage = read('src/app/today/page.tsx')
const performancePage = read('src/app/performance/page.tsx')
const modelLabPage = read('src/app/model-lab/page.tsx')
const dataHealthPage = read('src/app/data-health/page.tsx')
const vercel = read('vercel.json')

check('artifact verdict', artifact.certificationVerdict === 'PICK_2_RESET_03_UI_SIMPLIFICATION_CERTIFIED')
check('provider calls zero', artifact.providerCalls === 0)
check('production mutations zero', artifact.productionDbMutations === 0)
check('new import blocked', artifact.flags.NEW_DATA_IMPORT_ALLOWED_NOW === 'NO')
check('automation inactive', artifact.flags.AUTOMATION_ACTIVATED === 'NO')
check('primary nav ready', artifact.flags.PRIMARY_NAVIGATION_PICK_2_READY === 'YES')
check('today ready', artifact.flags.TODAY_PICK_2_SURFACE_READY === 'YES')
check('performance ready', artifact.flags.PERFORMANCE_PICK_2_CLEAN_START_READY === 'YES')
check('model lab ready', artifact.flags.MODEL_LAB_PICK_2_SURFACE_READY === 'YES')
check('data health ready', artifact.flags.DATA_HEALTH_PICK_2_SURFACE_READY === 'YES')
check('legacy isolation', artifact.flags.UI_LEGACY_METRIC_ISOLATION === 'PASS')
check('technical clutter removed', artifact.flags.TECHNICAL_CERTIFICATION_CLUTTER_REMOVED_FROM_PRODUCT_UI === 'YES')
check('home simplified', artifact.flags.PICK_2_HOME_SIMPLIFIED === 'YES')

for (const route of ['src/app/today/page.tsx', 'src/app/performance/page.tsx', 'src/app/model-lab/page.tsx', 'src/app/data-health/page.tsx']) {
  check(`${route} exists`, exists(route))
}

for (const label of ['Today', 'Performance', 'Model Lab', 'Data Health']) {
  check(`nav includes ${label}`, shell.includes(`label: '${label}'`))
}

for (const legacy of ['Probability Picks', 'Most Likely', 'Best Value', 'Betting Workbench', 'AI Operations', 'Sports Center', 'Player Projections']) {
  check(`primary nav excludes ${legacy}`, !shell.includes(`label: '${legacy}'`) && !shell.includes(`>${legacy}<`))
}

check('root uses pick2 surface', rootPage.includes('<Pick2Surface area="today" />'))
check('today uses pick2 surface', todayPage.includes('<Pick2Surface area="today" />'))
check('performance uses pick2 surface', performancePage.includes('<Pick2Surface area="performance" />'))
check('model lab uses pick2 surface', modelLabPage.includes('<Pick2Surface area="model-lab" />'))
check('data health uses pick2 surface', dataHealthPage.includes('<Pick2Surface area="data-health" />'))
check('performance clean start predictions zero', surface.includes("label: 'Predictions', value: '0'"))
check('performance clean start accuracy na', surface.includes("label: 'Accuracy', value: 'N/A'"))
check('model lab no champion', surface.includes('No Pick 2 champion model has been promoted yet.'))
check('data health statcast pending', surface.includes("label: 'Statcast', value: 'Not Yet Imported'"))
check('today no legacy recommendations', surface.includes('Legacy picks are not relabeled as Pick 2 plays.'))

check('api route count unchanged', countNamedFiles('src/app', 'route.ts') === artifact.pageDelta.apiRouteFiles)
check('page count matches', countNamedFiles('src/app', 'page.tsx') === artifact.pageDelta.pagesAfter)
check('top-level service count unchanged', fs.readdirSync(path.join(root, 'src/services')).filter((file) => file.endsWith('.ts')).length === artifact.serviceCount)
check('operating-day cron preserved', vercel.includes('/api/cron/operating-day'))
check('nba cron preserved', vercel.includes('/api/cron/nba-current-era-shadow'))

if (failures.length) {
  console.error(JSON.stringify({ validator: 'pick-2-reset-03-ui-simplification-validate', status: 'FAIL', failed: failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  validator: 'pick-2-reset-03-ui-simplification-validate',
  status: 'PASS',
  checks: 34,
  providerCalls: 0,
  productionDbMutations: 0,
}, null, 2))

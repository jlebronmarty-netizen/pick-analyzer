import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/pick-2-reset-02a-runtime-simplification.json')
const reset01Path = path.join(root, 'docs/CERTIFICATION/pick-2-reset-01-legacy-freeze-inventory.json')
const markdownPath = path.join(root, 'docs/CERTIFICATION/PICK_2_RESET_02A_RUNTIME_SIMPLIFICATION.md')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function countNamedFiles(dir, name) {
  let total = 0
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) total += countNamedFiles(rel, name)
    else if (entry.isFile() && entry.name === name) total += 1
  }
  return total
}

function countTopLevelServiceFiles() {
  return fs.readdirSync(path.join(root, 'src/services'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .length
}

const artifact = readJson(artifactPath)
const reset01 = readJson(reset01Path)
const markdown = fs.readFileSync(markdownPath, 'utf8')
const vercel = readJson(path.join(root, 'vercel.json'))

const checks = []
function check(name, pass, details = {}) {
  checks.push({ name, status: pass ? 'PASS' : 'FAIL', ...details })
}

check('RESET-01 manifest loaded', reset01.certificationVerdict === 'PICK_2_RESET_01_LEGACY_FREEZE_AND_EXACT_INVENTORY_CERTIFIED')
check('RESET-02A verdict recorded', artifact.certificationVerdict === 'PICK_2_RESET_02A_BOUNDED_RUNTIME_SIMPLIFICATION_CERTIFIED')
check('no provider calls', artifact.providerCalls === 0)
check('no production DML mutations', artifact.productionDmlMutations === 0)
check('no table drops or migrations', artifact.tableDrops === 0 && artifact.migrations === 0)
check('no automation or cron activation', artifact.automationActivated === false && artifact.newCron === false)
check('core safety preserved', artifact.flags.CORE_SAFETY_INFRASTRUCTURE_PRESERVED === 'YES')
check('safe delete set certified', artifact.flags.SAFE_RUNTIME_DELETE_SET_CERTIFIED === 'YES')
check('route dependency audit pass', artifact.flags.ROUTE_DEPENDENCY_AUDIT === 'PASS')
check('service dependency audit pass', artifact.flags.SERVICE_DEPENDENCY_AUDIT === 'PASS')
check('import graph clean', artifact.flags.IMPORT_GRAPH_CLEAN === 'YES')
check('pick 2 era unchanged', artifact.flags.PICK_2_ERA_BOUNDARY_UNCHANGED === 'YES')
check('new data import still blocked', artifact.flags.NEW_DATA_IMPORT_ALLOWED_NOW === 'NO')
check('admin diagnostics page removed', !exists('src/app/admin/historical-diagnostics/page.tsx'))
check('unused BSN prediction wrapper removed', !exists('src/services/bsn-predictions.service.ts'))
check('system version route preserved', exists('src/app/api/system/version/route.ts'))
check('operating-day cron preserved', exists('src/app/api/cron/operating-day/route.ts'))
check('NBA shadow cron preserved for explicit later cleanup', exists('src/app/api/cron/nba-current-era-shadow/route.ts'))
check('vercel cron unchanged', JSON.stringify(vercel.crons?.map((cron) => cron.path).sort()) === JSON.stringify(['/api/cron/nba-current-era-shadow', '/api/cron/operating-day'].sort()))
check('app page inventory preserves RESET-02A removal baseline', countNamedFiles('src/app', 'page.tsx') >= artifact.inventoryAfterExpected.appPageFiles)
check('api route inventory does not exceed RESET-02A baseline', countNamedFiles('src/app', 'route.ts') <= artifact.inventoryAfterExpected.apiRouteFiles)
check('top-level service inventory delta matches', countTopLevelServiceFiles() === artifact.inventoryAfterExpected.topLevelServiceFiles)
check('markdown certification present', markdown.includes('PICK_2_RESET_02A_BOUNDED_RUNTIME_SIMPLIFICATION_CERTIFIED'))
check('production isolation recorded', artifact.productionDataIsolation.dbMutations === 0 && artifact.productionDataIsolation.pick2EraChanged === false)

const failed = checks.filter((item) => item.status !== 'PASS')
const result = {
  validator: 'pick-2-reset-02a-runtime-simplification-validate',
  status: failed.length ? 'FAIL' : 'PASS',
  checks: checks.length,
  failed,
  providerCalls: artifact.providerCalls,
  productionDbMutations: artifact.productionDmlMutations,
}

console.log(JSON.stringify(result, null, 2))
if (failed.length) process.exit(1)

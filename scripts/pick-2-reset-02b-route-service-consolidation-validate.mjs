import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifact = JSON.parse(fs.readFileSync(path.join(root, 'docs/CERTIFICATION/pick-2-reset-02b-route-service-consolidation.json'), 'utf8'))
const reset01 = JSON.parse(fs.readFileSync(path.join(root, 'docs/CERTIFICATION/pick-2-reset-01-legacy-freeze-inventory.json'), 'utf8'))
const reset02a = JSON.parse(fs.readFileSync(path.join(root, 'docs/CERTIFICATION/pick-2-reset-02a-runtime-simplification.json'), 'utf8'))
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))

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

function countTopLevelServices() {
  return fs.readdirSync(path.join(root, 'src/services'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .length
}

const removedRoutes = artifact.routes.removed.map((route) => route.file)
const checks = []
function check(name, pass, details = {}) {
  checks.push({ name, status: pass ? 'PASS' : 'FAIL', ...details })
}

check('RESET-01 manifest available', reset01.certificationVerdict === 'PICK_2_RESET_01_LEGACY_FREEZE_AND_EXACT_INVENTORY_CERTIFIED')
check('RESET-02A manifest available', reset02a.certificationVerdict === 'PICK_2_RESET_02A_BOUNDED_RUNTIME_SIMPLIFICATION_CERTIFIED')
check('RESET-02B verdict recorded', artifact.certificationVerdict === 'PICK_2_RESET_02B_ROUTE_SERVICE_CONSOLIDATION_CERTIFIED')
check('no provider calls', artifact.providerCalls === 0)
check('no production DB mutations', artifact.productionDbMutations === 0 && artifact.productionDml === 0)
check('no schema/model/calibration/product changes', artifact.tableSchemaChanges === 0 && artifact.modelChanges === 0 && artifact.calibrationChanges === 0 && artifact.productWrites === 0)
check('no automation or cron activation', artifact.automationActivated === false && artifact.newCron === false)
check('core safety preserved', artifact.flags.CORE_SAFETY_INFRASTRUCTURE_PRESERVED === 'YES')
check('route consolidation certified', artifact.flags.ROUTE_CONSOLIDATION_CERTIFIED === 'YES')
check('service consolidation certified', artifact.flags.SERVICE_CONSOLIDATION_CERTIFIED === 'YES')
check('runtime dependency graph clean', artifact.flags.RUNTIME_DEPENDENCY_GRAPH_CLEAN === 'YES')
check('Pick 2 era unchanged', artifact.flags.PICK_2_ERA_BOUNDARY_UNCHANGED === 'YES')
check('new data import remains blocked', artifact.flags.NEW_DATA_IMPORT_ALLOWED_NOW === 'NO')
check('all selected route files removed', removedRoutes.every((file) => !exists(file)), { removedRoutes })
check('system version route preserved', exists('src/app/api/system/version/route.ts'))
check('active crons preserved', exists('src/app/api/cron/operating-day/route.ts') && exists('src/app/api/cron/nba-current-era-shadow/route.ts'))
check('vercel cron unchanged', JSON.stringify(vercel.crons?.map((cron) => cron.path).sort()) === JSON.stringify(['/api/cron/nba-current-era-shadow', '/api/cron/operating-day'].sort()))
check('api route count matches artifact', countNamedFiles('src/app', 'route.ts') === artifact.routes.apiRoutesAfter)
check('app page count preserves RESET-02B baseline', countNamedFiles('src/app', 'page.tsx') >= artifact.routes.appPagesAfter)
check('service count matches artifact', countTopLevelServices() === artifact.services.after)
check('MLB projections alias preserved due active callers', exists('src/app/api/mlb/projections/route.ts'))
check('documentation present', exists('docs/CERTIFICATION/PICK_2_RESET_02B_ROUTE_SERVICE_CONSOLIDATION.md'))

const failed = checks.filter((check) => check.status !== 'PASS')
console.log(JSON.stringify({
  validator: 'pick-2-reset-02b-route-service-consolidation-validate',
  status: failed.length ? 'FAIL' : 'PASS',
  checks: checks.length,
  failed,
  providerCalls: artifact.providerCalls,
  productionDbMutations: artifact.productionDbMutations,
}, null, 2))

if (failed.length) process.exit(1)

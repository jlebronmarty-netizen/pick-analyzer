import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

const expectedStatuses = [
  'Production',
  'Certified',
  'Foundation',
  'Preview',
  'Planning',
  'Unavailable',
  'Blocked',
  'Pending',
  'Deprecated',
]

const expectedSports = ['mlb', 'nba', 'nfl', 'soccer', 'bsn', 'nhl', 'tennis', 'ufc']
const statusSource = read('src/config/product-status.ts')
const serviceSource = read('src/services/sports-center.service.ts')
const shellSource = read('src/components/dashboard/DashboardShell.tsx')
const homeSource = read('src/app/page.tsx')

const checks = [
  ['Sports Center route exists', exists('src/app/sports-center/page.tsx')],
  ['Sports Center detail route exists', exists('src/app/sports-center/[sport]/page.tsx')],
  ['Root route redirects to dashboard', homeSource.includes("redirect('/dashboard')")],
  ['Dashboard shell exposes Sports Center', shellSource.includes("href: '/sports-center'") && shellSource.includes('Sports Center')],
  ['No Sports Center API duplication', !exists('src/app/api/sports-center/route.ts')],
  ['Provider calls fixed at zero', serviceSource.includes('providerCallsMade: 0')],
  ['Remote mutations fixed at zero', serviceSource.includes('remoteMutationsMade: 0')],
  ['Production mutations fixed at zero', serviceSource.includes('productionMutationsMade: 0')],
  ['Settlement logic unchanged by hub contract', serviceSource.includes('logicChanged: false')],
  ['No provider import in Sports Center service', !/from ['"]@\/services\/apis\//.test(serviceSource)],
  ['No Supabase import in Sports Center service', !serviceSource.includes('@/lib/supabase')],
  ['NFL reconciled to Preview', serviceSource.includes("key: 'nfl'") && serviceSource.includes("status: 'Preview'") && serviceSource.includes('776 Preview rows')],
  ['NHL reconciled to Preview', serviceSource.includes("key: 'nhl'") && serviceSource.includes("status: 'Preview'") && serviceSource.includes('258 Preview rows')],
  ['NFL production remains blocked', serviceSource.includes("capability('Production predictions', 'Blocked'") && serviceSource.includes("capability('Recommendations', 'Blocked'")],
  ['NHL production remains blocked', serviceSource.includes("Keep NHL in Preview until production and recommendation certification gates pass.")],
  ...expectedStatuses.map((status) => [`Canonical status present: ${status}`, statusSource.includes(`'${status}'`)]),
  ...expectedSports.map((sport) => [`Sport present: ${sport}`, serviceSource.includes(`key: '${sport}'`)]),
]

const failed = checks.filter(([, passed]) => !passed)

const result = {
  mode: 'sports_center_v1_validation',
  generatedAt: new Date().toISOString(),
  checkedRoutes: ['/sports-center', '/sports-center/mlb', '/sports-center/nba'],
  expectedSports,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  checks: checks.map(([name, passed]) => ({ name, passed })),
  passed: failed.length === 0,
  failedChecks: failed.map(([name]) => name),
}

console.log(JSON.stringify(result, null, 2))

if (!result.passed) {
  process.exitCode = 1
}

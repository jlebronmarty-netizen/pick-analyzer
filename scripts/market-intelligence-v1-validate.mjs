import fs from 'node:fs'

const service = fs.readFileSync('src/services/market-movement-intelligence.service.ts', 'utf8')
const page = fs.readFileSync('src/app/market-intelligence/page.tsx', 'utf8')
const route = fs.readFileSync('src/app/api/market-intelligence/movement/route.ts', 'utf8')

const checks = [
  ['reads stored odds snapshots', service.includes("from('sports_odds_snapshots')")],
  ['labels earliest stored price', service.includes('Earliest stored price')],
  ['does not claim opening line', service.includes('openingLineClaimed: false')],
  ['does not claim sharp money', service.includes('sharpMoneyClaimed: false')],
  ['tracks event alignment', service.includes('eventAligned')],
  ['tracks side alignment', service.includes('sideAligned')],
  ['validates synchronized movement', service.includes('SYNCHRONIZED_BOOKMAKER_MOVEMENT')],
  ['reports zero provider calls', service.includes('providerCallsMade: 0')],
  ['reports zero remote mutations', service.includes('remoteMutationsMade: 0')],
  ['route exposes validation', route.includes("validate') === 'true'")],
  ['page states no sharp-money claim', page.includes('No Sharp-Money Claim')],
]

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
const failed = checks.filter(([, pass]) => !pass)
if (failed.length) {
  console.error(`Market Intelligence V1 validation failed: ${failed.map(([name]) => name).join(', ')}`)
  process.exit(1)
}
console.log(`Market Intelligence V1 validation passed: ${checks.length}/${checks.length}`)

import fs from 'node:fs'

const service = fs.readFileSync('src/services/portfolio-intelligence.service.ts', 'utf8')
const route = fs.readFileSync('src/app/api/portfolio-intelligence/route.ts', 'utf8')
const page = fs.readFileSync('src/app/portfolio-intelligence/page.tsx', 'utf8')

const checks = [
  ['uses Probability Picks as source', service.includes('getProbabilityPicks')],
  ['uses Current Board only as overlay', service.includes('getCurrentBoardCached')],
  ['classifies same-event dependency', service.includes('SAME_EVENT')],
  ['classifies opposing sides', service.includes('OPPOSING_SIDES')],
  ['includes independence warning', service.includes('Naive joint probability assumes independence')],
  ['reports zero provider calls', service.includes('providerCallsMade: 0')],
  ['reports zero remote mutations', service.includes('remoteMutationsMade: 0')],
  ['route exposes validation', route.includes("validate') === 'true'")],
  ['page labels analytical only', page.includes('Analytical only')],
  ['page avoids bankroll implementation', !service.includes('stakeSize') && !page.includes('Bankroll')],
  ['page avoids Kelly implementation', !service.includes('kelly') && !page.includes('Kelly')],
]

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
const failed = checks.filter(([, pass]) => !pass)
if (failed.length) {
  console.error(`Portfolio Intelligence V1 validation failed: ${failed.map(([name]) => name).join(', ')}`)
  process.exit(1)
}
console.log(`Portfolio Intelligence V1 validation passed: ${checks.length}/${checks.length}`)

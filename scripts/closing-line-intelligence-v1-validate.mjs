import { readFileSync } from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'local-validation-service-role-key'

const { validateClosingLineFixtures } = await import('../src/services/closing-line-intelligence.service.ts')

const result = validateClosingLineFixtures()

for (const check of result.checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}`)
}

const route = readFileSync('src/app/api/closing-line/intelligence/route.ts', 'utf8')
const service = readFileSync('src/services/closing-line-intelligence.service.ts', 'utf8')
const page = readFileSync('src/app/closing-line-intelligence/page.tsx', 'utf8')

const staticChecks = [
  ['route exposes validation', route.includes('validateClosingLineFixtures')],
  ['no estimated closing line', service.includes('estimatedClosingLineUsed: false')],
  ['post-start prices excluded', service.includes('parsed < start')],
  ['shared odds conversion reused', service.includes("from '@/services/market-alignment.service'")],
  ['page states no estimated close', page.includes('No post-start price, estimated close or provider reconstruction is used.')],
  ['zero provider calls', result.providerCallsMade === 0],
  ['zero remote mutations', result.remoteMutationsMade === 0],
]

for (const [name, passed] of staticChecks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const passed = result.success && staticChecks.every(([, ok]) => ok)

if (!passed) {
  console.error('Closing Line Intelligence V1 validation failed')
  process.exit(1)
}

console.log(`Closing Line Intelligence V1 validation passed: ${result.checks.length + staticChecks.length}/${result.checks.length + staticChecks.length}`)

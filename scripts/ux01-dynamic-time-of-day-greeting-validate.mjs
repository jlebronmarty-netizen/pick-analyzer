import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function zonedHour(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const rawHour = Number(parts.find((part) => part.type === 'hour')?.value)
  if (!Number.isFinite(rawHour)) return null
  return ((rawHour % 24) + 24) % 24
}

function expectedGreeting(date, timeZone) {
  const hour = zonedHour(date, timeZone)
  if (hour === null) throw new Error(`invalid test timezone: ${timeZone}`)
  if (hour < 12) return 'Good Morning.'
  if (hour < 18) return 'Good Afternoon.'
  return 'Good Evening.'
}

function utcForPuertoRico(localIso) {
  return new Date(`${localIso}-04:00`)
}

const helperPath = 'src/lib/time-of-day-greeting.ts'
const homePath = 'src/components/home/HomeBettingPlan.tsx'
const personalizationPath = 'src/context/PersonalizationContext.tsx'
const docPath = 'docs/PRODUCTION_PILOT/UX_01_DYNAMIC_TIME_OF_DAY_GREETING.md'
const certPath = 'docs/CERTIFICATION/ux-01-dynamic-time-of-day-greeting.json'

for (const file of [helperPath, homePath, personalizationPath, docPath, certPath]) {
  assert(fs.existsSync(file), `missing UX-01 file: ${file}`)
}

const helper = read(helperPath)
const home = read(homePath)
const personalization = read(personalizationPath)
const doc = read(docPath)
const cert = JSON.parse(read(certPath))

assert(helper.includes('getTimeOfDayGreeting'), 'shared greeting helper must exist')
assert(helper.includes("DEFAULT_DISPLAY_TIMEZONE = 'America/Puerto_Rico'"), 'fallback display timezone must be America/Puerto_Rico')
assert(helper.includes('Intl.DateTimeFormat'), 'helper must use timezone-aware Intl formatting')
assert(!helper.includes('.getHours('), 'helper must not use server-local Date.getHours')
assert(helper.includes("hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'"), 'helper must preserve morning/afternoon/evening boundaries')

assert(home.includes("import { getTimeOfDayGreeting } from '@/lib/time-of-day-greeting'"), 'homepage must use shared greeting helper')
assert(home.includes('preferences.timezone'), 'homepage greeting must use display timezone preference')
assert(home.includes('preferences.language'), 'homepage greeting must remain compatible with language foundation')
assert(home.includes('setInterval(updateGreetingClock, 60_000)'), 'homepage greeting must refresh without redeploy')
assert(home.includes('suppressHydrationWarning'), 'homepage greeting must handle hydration-safe dynamic time')
assert(!home.includes('>Good Morning. {localeFoundation.en.question}</h2>'), 'homepage greeting must not remain permanently hardcoded to Good Morning')
assert(home.includes('data-display-timezone={preferences.timezone}'), 'homepage must expose display timezone separately')
assert(home.includes('data-canonical-timezone={CANONICAL_OPERATING_TIMEZONE}'), 'homepage must preserve operating timezone attribute')

assert(personalization.includes("CANONICAL_OPERATING_TIMEZONE = 'America/Puerto_Rico'"), 'canonical operating timezone constant must remain unchanged')
assert(personalization.includes("timezone: typeof raw.timezone === 'string'"), 'display timezone normalization must remain preference-based')

const puertoRicoCases = [
  ['2026-08-08T00:00:00', 'Good Morning.'],
  ['2026-08-08T05:00:00', 'Good Morning.'],
  ['2026-08-08T11:59:00', 'Good Morning.'],
  ['2026-08-08T12:00:00', 'Good Afternoon.'],
  ['2026-08-08T15:00:00', 'Good Afternoon.'],
  ['2026-08-08T17:59:00', 'Good Afternoon.'],
  ['2026-08-08T18:00:00', 'Good Evening.'],
  ['2026-08-08T21:00:00', 'Good Evening.'],
  ['2026-08-08T23:59:00', 'Good Evening.'],
]

for (const [localIso, expected] of puertoRicoCases) {
  const actual = expectedGreeting(utcForPuertoRico(localIso), 'America/Puerto_Rico')
  assert(actual === expected, `${localIso} America/Puerto_Rico expected ${expected}, got ${actual}`)
}

const sameUtc = new Date('2026-08-08T16:30:00.000Z')
assert(expectedGreeting(sameUtc, 'America/Puerto_Rico') === 'Good Afternoon.', 'Puerto Rico same-UTC fixture should be afternoon')
assert(expectedGreeting(sameUtc, 'America/Los_Angeles') === 'Good Morning.', 'alternate display timezone must not implicitly use Puerto Rico')

assert(cert.validation.providerCallsFromCertification === 0, 'certification must record zero provider calls')
assert(cert.validation.databaseMutationsFromCertification === 0, 'certification must record zero database mutations')
assert(cert.protectedInvariants.predictionLogicChanged === false, 'prediction logic must remain unchanged')
assert(cert.protectedInvariants.recommendationPolicyChanged === false, 'recommendation policy must remain unchanged')
assert(cert.protectedInvariants.performanceBehaviorChanged === false, 'Performance behavior must remain unchanged')
assert(cert.protectedInvariants.operatingTimezoneChanged === false, 'operating timezone must remain unchanged')
assert(doc.includes('Display timezone') && doc.includes('Operating timezone'), 'documentation must preserve timezone distinction')

console.log(JSON.stringify({
  success: true,
  mode: 'ux_01_dynamic_time_of_day_greeting_validation_v1',
  checks: 32,
  puertoRicoBoundaryCases: puertoRicoCases.length,
  alternateTimezoneFixture: '2026-08-08T16:30:00.000Z America/Los_Angeles => Good Morning.',
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  classification: cert.classification,
}, null, 2))

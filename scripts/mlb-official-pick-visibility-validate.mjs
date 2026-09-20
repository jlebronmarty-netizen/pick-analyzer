import assert from 'node:assert/strict'
import fs from 'node:fs'

const projection = fs.readFileSync('src/services/pick2-operational-projection.ts','utf8')
const cards = fs.readFileSync('src/components/pick2/MlbCards.tsx','utf8')
const presentation = fs.readFileSync('src/components/pick2/mlb-presentation.ts','utf8')
const performance = fs.readFileSync('src/app/performance/page.tsx','utf8')
const performanceRead = fs.readFileSync('src/services/pick2-mlb-performance-read.service.ts','utf8')

assert.match(projection, /const status = pick\s*\? 'OFFICIAL_PICK'/)
assert.ok(projection.indexOf("const status = pick") < projection.indexOf("? 'BLOCKED'"), 'persisted Official Pick must outrank current blockers')
assert.match(cards, /Certified .*decision_at/)
assert.match(cards, /Current market:/)
assert.match(cards, /Why .*Official Pick/)
assert.match(presentation, /original decision remains immutable/i)
assert.match(performance, /Official Pick ledger/)
assert.match(performance, /Unique selections/)
assert.match(performance, /Awaiting settlement/)
assert.match(performanceRead, /pick2_mlb_official_picks/)
assert.match(performanceRead, /PICKS_AWAITING_SETTLEMENT/)
assert.match(performanceRead, /uniqueSelections/)
assert.match(performanceRead, /storedDecisionRows/)

console.log('MLB Official Pick visibility + Performance ledger contract: PASS')

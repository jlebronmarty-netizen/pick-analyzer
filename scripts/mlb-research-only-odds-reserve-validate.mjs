import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const pa13=fs.readFileSync('src/services/pa13-pitcher-er-forward-capture.service.ts','utf8')
const alt=fs.readFileSync('src/services/mlb-runline-home-p15-alt-shadow.service.ts','utf8')

function quotaFunction(source) {
  const start=source.indexOf('async function latestKnownRequestsRemaining()')
  const end=source.indexOf('function validIso', start)
  assert(start>=0 && end>start)
  return source.slice(start,end)
}

test('PA13 blocks before provider call when persisted reserve is reached',()=>{
  const guard=pa13.indexOf('const knownRemainingBefore = await latestKnownRequestsRemaining()')
  const blocked=pa13.indexOf("status: 'BLOCKED_CREDIT_RESERVE'", guard)
  const provider=pa13.indexOf('https://api.the-odds-api.com', guard)
  assert(guard>=0 && blocked>guard && provider>blocked)
  assert.match(pa13,/let remaining: number \| null = knownRemainingBefore/)
})

test('Run Line alternate blocks before provider call when persisted reserve is reached',()=>{
  const guard=alt.indexOf('const knownRemainingBefore = await latestKnownRequestsRemaining()')
  const blocked=alt.indexOf("status: 'BLOCKED_CREDIT_RESERVE'", guard)
  const provider=alt.indexOf('https://api.the-odds-api.com', guard)
  assert(guard>=0 && blocked>guard && provider>blocked)
  assert.match(alt,/let remaining: number \| null = knownRemainingBefore/)
})

test('quota reads are cross-date and support both remaining metadata shapes',()=>{
  for (const source of [pa13,alt]) {
    const fn=quotaFunction(source)
    assert.doesNotMatch(fn,/puertoRicoUtcRange|\.gte\('completed_at'|\.lt\('completed_at'/)
    assert.match(fn,/requestsRemainingAfter \?\? metadata\.requestsRemaining/)
    assert.match(fn,/\.order\('completed_at', \{ ascending: false \}\)/)
    assert.match(fn,/\.limit\(100\)/)
  }
})

test('research boundaries remain closed',()=>{
  for (const source of [pa13,alt]) {
    assert.match(source,/researchOnly: true/)
    assert.match(source,/productionEligible: false/)
    assert.match(source,/officialPicksModified: false/)
    assert.match(source,/apostarActivated: false/)
  }
})

import assert from 'node:assert/strict'
import {
  buildStandardRunlineOpeningProxy,
  evaluateStandardRunlineV2,
  MLB_RUNLINE_V2_CORE_THRESHOLD,
  MLB_RUNLINE_V2_TRANSFER_THRESHOLD,
} from '../../src/lib/mlb-runline-v2-standard.ts'

const rows = [
  ['betmgm','2026-09-01T01:37:01Z',-115,-105],
  ['betonlineag','2026-09-01T01:36:37Z',-115,-105],
  ['betrivers','2026-09-01T01:36:38Z',-118,-103],
  ['betus','2026-09-01T01:36:39Z',-115,-105],
  ['bovada','2026-09-01T01:36:41Z',-110,-110],
  ['draftkings','2026-09-01T01:36:39Z',-115,-105],
  ['fanatics','2026-09-01T01:36:38Z',-115,-105],
  ['fanduel','2026-09-01T01:37:00Z',-113,-106],
  ['lowvig','2026-09-01T01:36:39Z',-112,-102],
  ['mybookieag','2026-09-01T01:35:30Z',-111,-105],
  ['williamhill_us','2026-09-01T01:34:50Z',-115,-105],
].flatMap(([sportsbook,snapshotTime,homePrice,awayPrice]) => [
  { sportsbook, snapshotTime, outcome:'home', line:1.5, price:homePrice },
  { sportsbook, snapshotTime, outcome:'away', line:-1.5, price:awayPrice },
])

const proxy = buildStandardRunlineOpeningProxy(rows)
assert.ok(proxy)
assert.equal(proxy.homeLine,1.5)
assert.equal(proxy.awayLine,-1.5)
assert.equal(proxy.books,11)
assert.ok(Math.abs(proxy.homePriceAvg - (-114)) <= 1e-12)
assert.ok(Math.abs(proxy.awayPriceAvg - (-105.090909090909)) <= 1e-12)
assert.equal(proxy.earliestSnapshotAt,'2026-09-01T01:34:50.000Z')
assert.equal(proxy.latestBookOpenSnapshotAt,'2026-09-01T01:37:01.000Z')
assert.equal(proxy.dogSide,'HOME')
assert.ok(Math.abs(proxy.marketPDog - 0.509711277766327) <= 1e-12)
assert.ok(Math.abs(proxy.marketZV2 - (-0.834092819344358)) <= 1e-12)

// First book observation is authoritative even when the book later changes to standard 1.5.
const switchRows = [
  { sportsbook:'a', snapshotTime:'2026-09-02T02:00:00Z', outcome:'home', line:1.5, price:-130 },
  { sportsbook:'a', snapshotTime:'2026-09-02T02:00:00Z', outcome:'away', line:-1.5, price:105 },
  { sportsbook:'b', snapshotTime:'2026-09-02T02:00:01Z', outcome:'home', line:1.0, price:102 },
  { sportsbook:'b', snapshotTime:'2026-09-02T02:00:01Z', outcome:'away', line:-1.0, price:-124 },
  { sportsbook:'b', snapshotTime:'2026-09-02T02:10:00Z', outcome:'home', line:1.5, price:-125 },
  { sportsbook:'b', snapshotTime:'2026-09-02T02:10:00Z', outcome:'away', line:-1.5, price:102 },
]
const switched = buildStandardRunlineOpeningProxy(switchRows)
assert.ok(switched)
assert.equal(switched.books,1)
assert.equal(switched.homeLine,1.5)

// Modal tie chooses the cohort that completed first.
const tieRows = [
  { sportsbook:'a',snapshotTime:'2026-09-04T02:07:04Z',outcome:'home',line:-1.5,price:203 },
  { sportsbook:'a',snapshotTime:'2026-09-04T02:07:04Z',outcome:'away',line:1.5,price:-245 },
  { sportsbook:'b',snapshotTime:'2026-09-04T02:06:38Z',outcome:'home',line:-1.5,price:195 },
  { sportsbook:'b',snapshotTime:'2026-09-04T02:06:38Z',outcome:'away',line:1.5,price:-235 },
  { sportsbook:'c',snapshotTime:'2026-09-04T02:05:44Z',outcome:'home',line:1.5,price:-207 },
  { sportsbook:'c',snapshotTime:'2026-09-04T02:05:44Z',outcome:'away',line:-1.5,price:169 },
  { sportsbook:'d',snapshotTime:'2026-09-04T07:15:50Z',outcome:'home',line:1.5,price:-215 },
  { sportsbook:'d',snapshotTime:'2026-09-04T07:15:50Z',outcome:'away',line:-1.5,price:170 },
]
const tie = buildStandardRunlineOpeningProxy(tieRows)
assert.ok(tie)
assert.equal(tie.homeLine,-1.5)
assert.equal(tie.awayLine,1.5)

assert.equal(MLB_RUNLINE_V2_CORE_THRESHOLD,1.0002553572466371)
assert.equal(MLB_RUNLINE_V2_TRANSFER_THRESHOLD,0.889684454234473)

const core = evaluateStandardRunlineV2({
  market:{...proxy,marketPDog:0.56,marketZV2:(Math.log(0.56/0.44)-0.334503755055181)/0.354461459732156,marketEligible:true,dogSide:'HOME'},
  recentFormDog:1.2,
  historyDog:0,
  fatigueTravelDog:1.0,
  dogFavHand:'R/R',
})
assert.equal(core.coreSelected,true)
assert.equal(core.transferSelected,false)
assert.equal(core.broadSelected,true)

const transfer = evaluateStandardRunlineV2({
  market:{...proxy,marketPDog:0.62,marketZV2:1.1,marketEligible:true,dogSide:'HOME'},
  recentFormDog:0,
  historyDog:0.8,
  fatigueTravelDog:0.8,
  dogFavHand:'L/R',
})
assert.equal(transfer.coreSelected,false)
assert.equal(transfer.transferSelected,true)
assert.equal(transfer.broadSelected,true)

console.log('Standard Run Line V2 forward-freeze contract: PASS')

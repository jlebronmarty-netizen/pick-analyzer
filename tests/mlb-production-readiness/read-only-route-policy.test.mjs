import test from 'node:test'
import assert from 'node:assert/strict'
import { isReadOnlySportRoute } from '../../src/lib/read-only-sport-route.mjs'

test('all originally protected MLB/canonical routes still avoid the legacy provider', () => {
  for (const path of ['/', '/today', '/mlb-value-board', '/data-health', '/performance']) {
    assert.equal(isReadOnlySportRoute(path), true, path)
  }
})

test('read-only sport routes and sports-center descendants avoid the legacy provider', () => {
  for (const path of ['/nba-market-data', '/nba', '/nhl', '/table-tennis', '/soccer', '/ncaab', '/ncaaf', '/sports', '/edge-lab', '/sports-center', '/sports-center/nba']) {
    assert.equal(isReadOnlySportRoute(path), true, path)
  }
})

test('unknown routes and similar prefixes retain legacy fallback', () => {
  for (const path of ['/dashboard', '/legacy', '/today-extra', '/sports-center-other', '/sports-elsewhere', null, undefined, 0]) {
    assert.equal(isReadOnlySportRoute(path), false, String(path))
  }
})

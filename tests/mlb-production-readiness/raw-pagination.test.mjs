import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPregameReadRepository } from '../../scripts/mlb-data-02r-r2t-r1-read-repository.mjs'
import { fetchR2NStatcastRowsForGames } from '../../scripts/mlb-data-02h-2026-current-foundation.mjs'

const rows = (n, game = 10, offset = 0) => Array.from({ length: n }, (_, i) => ({ id: `raw-${offset + i}`, game_pk: game }))
const target = { gamePk: 99, gameDate: '2026-10-14', performanceCutoff: '2026-10-14', homeTeamId: 'mlb:home', awayTeamId: 'mlb:away' }
const starters = { home: { mlbam_pitcher_id: 1 }, away: { mlbam_pitcher_id: 2 } }
function database(raw, { cap = 1000, countPatch, pagePatch, error = false } = {}) {
  let reads = 0
  return { from(table) {
    let selected = '', opts, scope, game, from = 0, to = Infinity, pitcher = false, identity = false
    const q = {
      select(s, o) { selected = s; opts = o; return q },
      in(column, value) { if (column === 'game_pk') scope = value; return q },
      eq(column, value) { if (column === 'game_pk') game = value; if (column === 'mlbam_pitcher_id') pitcher = true; return q },
      gte() { return q }, lt() { return q }, order() { return q },
      or() { identity = true; return q }, limit(n) { to = n - 1; return q },
      range(a, b) { from = a; to = b; return q },
      then(resolve, reject) {
        if (table === 'pick2_mlb_games') return Promise.resolve({ data: [...new Set(raw.map(r => r.game_pk))].map(game_pk => ({ game_pk, game_date: '2026-10-01' })), error: null }).then(resolve, reject)
        assert.equal(table, 'pick2_raw_mlb_statcast_pitches')
        if (pitcher || identity) return Promise.resolve({ data: [], count: 0, error: null }).then(resolve, reject)
        assert.ok(selected.includes('id'))
        assert.equal(opts?.count, 'exact')
        reads++
        const all = raw.filter(r => scope ? scope.includes(r.game_pk) : r.game_pk === game).sort((a, b) => a.game_pk - b.game_pk || a.id.localeCompare(b.id))
        const data = all.slice(from, Math.min(to + 1, from + cap))
        return Promise.resolve({ data: pagePatch ? pagePatch(data, reads) : data, count: countPatch ? countPatch(all.length, reads) : all.length, error: error ? { code: 'XX000' } : null }).then(resolve, reject)
      },
    }
    return q
  } }
}
const readers = {
  dependencies: async (db, raw) => (await createPregameReadRepository(db).readDependencies(target, starters)).rows,
  canonicalCache: (db, raw) => fetchR2NStatcastRowsForGames({ db, eligibleGamePks: [...new Set(raw.map(r => r.game_pk))], runAsOf: '2026-10-14T16:00:00Z', cacheDir: null, fetchImpl: () => { throw Error('NETWORK_FORBIDDEN') } }),
}
for (const [name, read] of Object.entries(readers)) {
  test(`${name}: complete multi-game pagination preserves every identity`, async () => {
    const raw = [...rows(600), ...rows(600, 11, 600)]
    const actual = await read(database(raw), raw)
    assert.deepEqual(actual.map(r => r.id).sort(), raw.map(r => r.id).sort())
  })
  test(`${name}: exact 1000-row boundary works`, async () => {
    const raw = rows(1000)
    assert.equal((await read(database(raw), raw)).length, 1000)
  })
  test(`${name}: short server page is rejected despite valid rows`, async () => {
    const raw = rows(600)
    await assert.rejects(read(database(raw, { cap: 500 }), raw), /TRUNCATED/)
  })
  test(`${name}: changing count is rejected on page two`, async () => {
    const raw = [...rows(600), ...rows(600, 11, 600)]
    await assert.rejects(read(database(raw, { countPatch: (n, page) => n + (page > 1 ? 1 : 0) }), raw), /COUNT|TRUNCATED/)
  })
  test(`${name}: missing exact count cannot become a valid sample`, async () => {
    const raw = rows(10)
    await assert.rejects(read(database(raw, { countPatch: () => null }), raw), /COUNT|TRUNCATED/)
  })
  test(`${name}: negative count is rejected without an unbounded page loop`, async () => {
    const raw = rows(10)
    await assert.rejects(read(database(raw, { countPatch: () => -1 }), raw), /COUNT|TRUNCATED/)
  })
  test(`${name}: duplicate raw identities are rejected`, async () => {
    const raw = [...rows(10), ...rows(10, 11, 10)]
    await assert.rejects(read(database(raw, { pagePatch: data => data.map(r => ({ ...r, id: 'duplicate' })) }), raw), /DUPLICATE/)
  })
  test(`${name}: a game above the original 1000-pitch cap is rejected`, async () => {
    const raw = [...rows(1001), ...rows(1, 11, 1001)]
    await assert.rejects(read(database(raw), raw), /CAP/)
  })
  test(`${name}: errors cannot be treated as missing evidence`, async () => {
    const raw = rows(10)
    await assert.rejects(read(database(raw, { error: true }), raw), /READ.*FAIL|scoped_raw_history/)
  })
  test(`${name}: out-of-scope rows cannot enter the feature corpus`, async () => {
    const raw = rows(10)
    await assert.rejects(read(database(raw, { pagePatch: data => data.map(r => ({ ...r, game_pk: 500 })) }), raw), /SCOPE/)
  })
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { projectMlbOperations } from '../../src/services/pick2-operational-projection.ts'
import { friendlyReason } from '../../src/components/pick2/mlb-presentation.ts'
const at = '2026-10-14T20:00:00Z'
const base = { game_pk: 1, game_date: '2026-10-14', scheduled_at: '2026-10-15T00:00:00Z', official_status: 'Scheduled', metadata: { homeProbablePitcher: { id: 1 }, awayProbablePitcher: { id: 2 } } }
function project(game) { return projectMlbOperations({ at, games: [game], predictions: [], values: [], picks: [], teams: [], schedules: [] }) }
test('postseason is explicitly outside the regular-season champion domain', () => {
 const result = project({ ...base, game_type: 'L' })
 assert.equal(result.games[0].reason, 'REGULAR_SEASON_MODEL_ONLY')
 assert.equal(result.games[0].gameStatus, 'BLOCKED')
 assert.equal(result.sources.length, 0)
 assert.match(friendlyReason(result.games[0].reason), /regular season only/)
})
test('regular season retains the existing evidence checks', () => {
 assert.equal(project({ ...base, game_type: 'R' }).games[0].reason, 'NO_OBSERVED_GAME_EVIDENCE')
})
test('final games retain final settlement display instead of becoming a domain warning', () => {
 const result = project({ ...base, game_type: 'L', official_status: 'Final' })
 assert.equal(result.games[0].gameStatus, 'FINAL')
 assert.equal(result.games[0].reason, 'FINAL_GAME')
})

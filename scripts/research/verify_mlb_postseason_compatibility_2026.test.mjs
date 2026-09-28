import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

const read = (p) => fs.readFileSync(p,'utf8')
const policy = read('src/services/mlb-game-type-policy.ts')

test('model target policy includes regular season and postseason rounds',()=>{
  for (const code of ["'R'","'F'","'D'","'L'","'W'"]) assert.ok(policy.includes(code), code)
})

test('official schedule and canonical preflight preserve game type',()=>{
  const provider=read('src/services/mlb-official-data-provider.service.ts')
  const preflight=read('src/services/mlb-canonical-slate-preflight.service.ts')
  assert.ok(provider.includes('gameTypes=${mlbModelGameTypesQuery()}'))
  assert.ok(provider.includes('gameType: isMlbModelGameType'))
  assert.ok(preflight.includes('game_type: game.gameType'))
  assert.ok(!preflight.includes("game_type: 'R'"))
})

test('active runline and prop runtimes are no longer regular-season-only',()=>{
  const std=read('src/services/mlb-runline-v2-standard-forward-freeze.service.ts')
  const alt=read('src/services/mlb-runline-home-p15-alt-forward-freeze.service.ts')
  const daily=read('src/services/mlb-approved-prop-daily-evaluation.service.ts')
  const capture=read('src/services/mlb-approved-prop-market-capture.service.ts')
  const recovery=read('src/services/mlb-approved-prop-future-recovery.service.ts')
  const pitcherFeatures=read('src/services/mlb-approved-prop-pitcher-feature-materializer.service.ts')
  const bdl=read('src/services/mlb-approved-prop-balldontlie-capture.service.ts')
  assert.ok(std.includes('isMlbModelGameType'))
  assert.ok(alt.includes('isMlbModelGameType'))
  assert.ok(daily.includes(".in('game_type', [...MLB_MODEL_GAME_TYPES])"))
  assert.ok(capture.includes('isMlbModelGameType'))
  assert.ok(recovery.includes(".in('game_type', [...MLB_MODEL_GAME_TYPES])"))
  assert.ok(pitcherFeatures.includes(".in('game_type', [...MLB_MODEL_GAME_TYPES])"))
  assert.ok(!bdl.includes("season_type', 'regular"))
})

test('opening consensus does not force regular season provider games',()=>{
  const ml=read('src/services/mlb-opening-consensus-prospective.service.ts')
  assert.ok(ml.includes(".in('game_type',[...MLB_MODEL_GAME_TYPES])"))
  assert.ok(!ml.includes("season_type:'regular'"))
})

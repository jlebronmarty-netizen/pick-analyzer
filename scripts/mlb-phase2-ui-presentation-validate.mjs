// Presentation-only fixtures. Never imported by application/runtime code.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url), cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const module = { exports: {} }; cache.set(file, module.exports)
  const localRequire = id => {
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) }
    if (id.includes('DashboardShell')) return { __esModule: true, default: ({ children }) => React.createElement('main', {}, children) }
    if (id.includes('operational-read.service')) return {}
    if (id.startsWith('.')) { const base = path.resolve(path.dirname(file), id); return load(['.tsx', '.ts'].map(s => base + s).find(fs.existsSync)) }
    return require(id)
  }
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInThisContext('(function(require,module,exports){' + output + '\n})', { filename: file })(localRequire, module, module.exports)
  cache.set(file, module.exports); return module.exports
}
const presentation = load('src/components/pick2/mlb-presentation.ts')
const { GameCard } = load('src/components/pick2/MlbCards.tsx')
const Board = load('src/components/pick2/MlbValueBoardClient.tsx').default
const { TodayContent } = load('src/components/pick2/MlbToday.tsx')
const game = { gamePk: 1, home: 'Home club', away: 'Away club', scheduledAt: '2026-09-12T20:00:00Z', status: 'Scheduled', gameStatus: 'READY', opportunities: [], homeStarter: 'Home starter', awayStarter: 'Away starter', homeProbability: 0.6, awayProbability: 0.4, homeMarket: null, awayMarket: null, predictionAt: null, evidenceAt: null, reason: null }
const row = { game_pk: 1, home_team: game.home, away_team: game.away, side: 'HOME', status: 'WATCHLIST', opportunity_status: 'NO_EDGE', start_time: game.scheduledAt, board_rank: 1, model_probability: 0.6, american_odds: -150, consensus_probability: 0.59, consensus_edge: 0.01, unit_ev: 0, best_book: 'Example book', bookmaker_name: null, market_freshness: 'FRESH', market_acquired_at: '2026-09-12T12:00:00Z', prediction_as_of: '2026-09-12T11:59:00Z', evaluated_at: '2026-09-12T12:00:01Z', blocker_codes: [], starter_status: 'CONFIRMED' }
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))
const checks = []
const check = (name, fn) => { fn(); checks.push({ name, status: 'PASS' }) }
check('Missing never displays as zero; probability and odds retain canonical units', () => { assert.equal(presentation.percent(null), '—'); assert.equal(presentation.price(undefined), '—'); assert.equal(presentation.percent(0), '0.0%'); assert.equal(presentation.percent(.041, true), '+4.1%'); assert.equal(presentation.price(120), '+120') })
check('No Edge has a neutral independent grouping, without relabeling canonical input', () => { const html = render(Board, { board: { rows: [row] }, games: [game] }); assert(html.includes('data-summary="NO_EDGE"')); assert(html.includes('data-classification="NO_EDGE"')); assert(!html.includes('data-classification="WATCHLIST"')); assert.equal(row.status, 'WATCHLIST'); assert(html.includes('No qualifying plays right now')) })
check('Official Picks and Value Candidates remain distinct and ordered', () => { const html = render(Board, { board: { rows: [{ ...row, side: 'AWAY', opportunity_status: 'VALUE_CANDIDATE' }, { ...row, opportunity_status: 'OFFICIAL_PICK' }] }, games: [game] }); assert(html.indexOf('data-classification="OFFICIAL_PICK"') < html.indexOf('data-classification="VALUE_CANDIDATE"')) })
check('Missing starter, stale evidence, stale odds, started and final have readable states', () => { for (const [reason, phrase] of [['MISSING_STARTER', 'Waiting for confirmed starter'], ['STALE_GAME_EVIDENCE', 'Waiting for fresh game data'], ['STALE_MARKET', 'Waiting for fresh odds'], ['GAME_STARTED', 'pregame recommendations locked']]) { const html = render(GameCard, { game: { ...game, reason }, rows: [] }); assert(html.includes(phrase)); assert(!html.includes(reason)) } assert(render(GameCard, { game: { ...game, status: 'Final' }, rows: [] }).includes('Final')) })
check('Complete and partial slates preserve all game cards; empty state is truthful', () => { const view = { date: '2026-09-12', warnings: [], games: [game, { ...game, gamePk: 2, reason: 'MISSING_STARTER' }], board: { rows: [row] } }; assert.equal((render(TodayContent, { view }).match(/data-game-card=/g) ?? []).length, 2); assert(render(TodayContent, { view: { ...view, games: [] } }).includes('does not mean there are no games')) })
check('Displayed percentages, price and timestamps preserve canonical meaning', () => { const html = render(GameCard, { game, rows: [row] }); assert(html.includes('60.0%')); assert(html.includes('-150')); assert(html.includes('+1.0%')); assert(html.includes('0.0%')); assert(!html.includes('>2026-09-12T')); assert(html.includes('no-vig quote')); assert.equal(presentation.prTime(game.scheduledAt), '4:00 PM PR') })
if (process.env.MLB_UI_CANONICAL_VIEW) {
  const view = JSON.parse(fs.readFileSync(process.env.MLB_UI_CANONICAL_VIEW, 'utf8'))
  check('Actual canonical view: game count and every opportunity classification match', () => { const today = render(TodayContent, { view }), board = render(Board, { board: view.board, games: view.games }); assert.equal((today.match(/data-game-card=/g) ?? []).length, view.games.length); for (const s of presentation.displayStatuses) assert.equal((board.match(new RegExp('data-classification="' + s + '"', 'g')) ?? []).length, view.board.rows.filter(r => presentation.presentationStatus(r) === s).length) })
  if (process.env.MLB_UI_RENDER_DIR) {
    const css = fs.readdirSync('.next/static/css').filter(f => f.endsWith('.css')).map(f => fs.readFileSync('.next/static/css/' + f, 'utf8')).join('\n')
    for (const [name, html] of [['today', render(TodayContent, { view })], ['board', render(Board, { board: view.board, games: view.games })]]) {
      fs.writeFileSync(path.join(process.env.MLB_UI_RENDER_DIR, name + '-nonempty-private.html'), '<!doctype html><html lang="en" class="pa-dark"><head><meta charset="utf-8"><title>Private presentation validation</title><style>' + css + '</style></head><body class="bg-slate-950 text-white"><main class="p-4">' + html + '</main></body></html>')
    }
  }
}
console.log(JSON.stringify({ status: 'PASS', checks, providerCalls: 0, productionDml: 0, productionDdl: 0 }))

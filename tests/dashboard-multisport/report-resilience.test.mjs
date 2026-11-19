import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MULTISPORT_READ_TIMEOUT_MS, readMultisportInputs} from '../../src/lib/multisport-report-resilience.ts';
import {mlbModelCohorts, nhlModelCohort, displayedModelTotal} from '../../src/lib/sport-model-overview.ts';
import {cohort, tennisCohort} from '../../src/lib/free-sports/model.ts';
import {ufcCohort} from '../../src/lib/ufc/free-v2.ts';
import {ncaabModelCohort} from '../../src/lib/ncaab-checkpoint.ts';
import {combinedDay} from '../../src/lib/multisport-day.ts';
import SportModelOverview from '../../src/components/dashboard/SportModelOverview.tsx';
import MultisportDayView from '../../src/components/dashboard/MultisportDayView.tsx';

const sources = ['research', 'official', 'nhl', 'soccer', 'tableTennis', 'ncaab', 'ufc', 'edgeLabCards', 'nbaCard', 'freeSports'];
const never = () => new Promise(() => {});
const readers = read => Object.fromEntries(sources.map(source => [source, () => read(source)]));
const flush = () => new Promise(resolve => setImmediate(resolve));
const nhl = () => ({status:'AVAILABLE', readAt:'2026-10-14T16:00:00Z',
  health:{status:'PASS', latestRunAt:'2026-10-14T15:30:00Z'},
  summary:{wins:1, losses:1, pending:1, pushes:0, voids:0, accuracyPct:50},
  history:[{id:'p', eventId:'1', scheduledAt:'2026-10-14T20:00:00Z', status:'ACTIVE', model:'DRATINGS_PUBLIC_V1', eventName:'AAA @ BBB', direction:'BBB ML', modelProbability:0.6, edgePp:5, odds:-146, sportsbook:'Circa'}],
  forecasts:[{id:'f', eventId:'1', eventName:'AAA @ BBB', scheduledAt:'2026-10-14T20:00:00Z', capturedAt:'2026-10-14T15:30:00Z', away:'AAA', home:'BBB', awayProbability:0.4, homeProbability:0.6, awayOdds:140, homeOdds:-156, awayEdgePp:-4, homeEdgePp:4}],
  games:[{eventId:'1', eventName:'AAA @ BBB', scheduledAt:'2026-10-14T20:00:00Z', status:'SCHEDULED', away:'AAA', home:'BBB'}],
});

test('all successful sources retain their exact values and clear their deadlines', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const values = Object.fromEntries(sources.map(source => [source, Object.freeze({source})]));
  const started = [], failures = [];
  const result = await readMultisportInputs(readers(source => {
    started.push(source);
    return Promise.resolve(values[source]);
  }), {onFailure: failure => failures.push(failure)});
  assert.deepEqual(started, sources);
  for (const source of sources) assert.equal(result[source], values[source]);
  assert.deepEqual(result.readWarnings, []);
  t.mock.timers.tick(MULTISPORT_READ_TIMEOUT_MS);
  await flush();
  assert.deepEqual(failures, []);
});

test('hung/rejected sources settle at the deadline while healthy sport results and calendar remain available', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const healthyNhl = nhl(), failures = [];
  let settled = false;
  const pending = readMultisportInputs({
    ...readers(never), nhl: () => Promise.resolve(healthyNhl),
    research: () => Promise.reject(Error('secret provider response')),
  }, {onFailure: failure => failures.push(failure)}).then(result => {settled = true; return result;});
  await flush();
  assert.deepEqual(failures, [{source:'research', code:'FAILED'}]);
  t.mock.timers.tick(MULTISPORT_READ_TIMEOUT_MS - 1);
  await flush();
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  const result = await pending;
  assert.equal(result.nhl, healthyNhl);
  assert.equal(result.official, null);
  for (const source of ['research', 'soccer', 'tableTennis', 'ncaab', 'ufc']) assert.equal(result[source].status, 'UNAVAILABLE');
  assert.equal(failures.length, 9);
  assert.equal(failures.filter(f => f.code === 'TIMEOUT').length, 8);
  assert.equal(result.readWarnings.length, 9);
  assert.doesNotMatch(JSON.stringify({failures, warnings:result.readWarnings}), /secret provider response/);

  const fallbackCohorts = [
    ...mlbModelCohorts(result.research, result.official), ...result.edgeLabCards.flatMap(c => c.cohorts),
    ufcCohort(result.ufc), ...result.nbaCard.cohorts, ncaabModelCohort(result.ncaab),
    ...result.freeSports.map(cohort), tennisCohort(result.freeSports.filter(r => ['ATP', 'WTA'].includes(r.league))),
  ];
  for (const c of fallbackCohorts) {
    assert.equal(c.available, false);
    for (const key of ['wins', 'losses', 'pending', 'accuracy']) assert.equal(c[key], null, c.key + '.' + key);
  }
  assert.equal(displayedModelTotal([...fallbackCohorts, nhlModelCohort(healthyNhl)]).accuracy, null);
  const cards = [{key:'nhl', label:'NHL', href:'/nhl', classification:'MODEL_ONLY', cohorts:[nhlModelCohort(healthyNhl)]},
    ...result.edgeLabCards, result.nbaCard,
    ...fallbackCohorts.map((c, i) => ({key:'unavailable-' + i, label:c.label, href:'/sports-center', classification:'SHADOW', cohorts:[c]}))];
  const html = renderToStaticMarkup(React.createElement(SportModelOverview, {cards}));
  assert.match(html, /50\.00%/);
  assert.match(html, /1 W \/ 1 L/);
  assert.match(html, /Resultados no conectados o no disponibles/);
  assert.doesNotMatch(html, /0 W \/ 0 L/);

  const view = {date:'2026-10-14', warnings:[], games:[], board:{rows:[]}};
  const day = combinedDay(view, result.nhl, result.research, result.ncaab, result.soccer, result.tableTennis, result.ufc, result.freeSports);
  day.warnings = [...result.readWarnings, ...day.warnings];
  assert.equal(day.games.length, 1);
  const calendarHtml = renderToStaticMarkup(React.createElement(MultisportDayView, {day, mlb:view}));
  assert.match(calendarHtml, /role="status"/);
  assert.match(calendarHtml, /NFL, tenis y BSN: la lectura tardó demasiado/);
  assert.match(calendarHtml, /AAA @ BBB/);
});

test('synchronous throws become unavailable immediately and logs contain fixed source/code only', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const warn = t.mock.method(console, 'warn', () => {});
  const result = await readMultisportInputs(readers(() => {throw Error('https://private.invalid?token=secret');}));
  assert.equal(result.research.status, 'UNAVAILABLE');
  assert.equal(result.freeSports.length, 4);
  assert.ok(result.freeSports.every(r => r.status === 'UNAVAILABLE'));
  const view = {date:'2026-10-14', warnings:[], games:[], board:{rows:[]}};
  const day = combinedDay(view, result.nhl, result.research, result.ncaab, result.soccer, result.tableTennis, result.ufc, result.freeSports);
  day.warnings = [...result.readWarnings, ...day.warnings];
  const html = renderToStaticMarkup(React.createElement(MultisportDayView, {day, mlb:view}));
  assert.match(html, /no se pudieron cargar los datos/);
  assert.match(html, /No se pueden mostrar partidos verificados/);
  assert.doesNotMatch(html, /No hay partidos en el calendario/);
  assert.equal(warn.mock.callCount(), sources.length);
  assert.deepEqual(warn.mock.calls.map(c => c.arguments), sources.map(source => ['[multisport-report]', source, 'FAILED']));
  t.mock.timers.tick(MULTISPORT_READ_TIMEOUT_MS);
  await flush();
  assert.equal(warn.mock.callCount(), sources.length);
});

test('late rejections after a timeout are consumed and cannot replace the fallback or log twice', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const failures = [], values = Object.fromEntries(sources.map(source => [source, {source}]));
  let rejectLate;
  const late = new Promise((_, reject) => {rejectLate = reject;});
  const pending = readMultisportInputs({...readers(source => Promise.resolve(values[source])), nhl: () => late},
    {onFailure: failure => failures.push(failure)});
  await flush();
  t.mock.timers.tick(MULTISPORT_READ_TIMEOUT_MS);
  const result = await pending, fallback = result.nhl;
  assert.equal(fallback.status, 'UNAVAILABLE');
  rejectLate(Error('private late error'));
  await flush();
  assert.equal(result.nhl, fallback);
  assert.deepEqual(failures, [{source:'nhl', code:'TIMEOUT'}]);
});

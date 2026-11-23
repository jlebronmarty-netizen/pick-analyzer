import test from 'node:test';
import assert from 'node:assert/strict';
import {NHL_RESEARCH_TABLES, NhlResearchReadError, readNhlResearchPages,
  readNhlResearchArchive, selectNhlScheduleReceiptIds} from '../src/lib/nhl-research-reader.mjs';
import {buildNhlResearchAudit} from '../src/lib/nhl-research-audit.mjs';

const cutoff = '2026-11-23T15:52:27.459Z';
const spec = {table: 'archive', select: 'id,captured_at', time: 'captured_at', order: ['id'], cap: 100};
function fakeDb(respond) {
  const calls = [];
  return {calls, from(table) {
    const request = {table, order: [], filters: []};
    const query = {
      select(columns, options) { request.select = columns; request.options = options; return query; },
      lte(column, value) { request.filters.push(['lte', column, value]); return query; },
      like(column, value) { request.filters.push(['like', column, value]); return query; },
      in(column, values) { request.filters.push(['in', column, values]); return query; },
      order(column, options) { request.order.push([column, options]); return query; },
      range(first, last) { request.range = [first, last]; return query; },
      abortSignal(signal) { request.signal = signal; return query; },
      then(resolve, reject) {
        const index = calls.length;
        calls.push(request);
        return Promise.resolve().then(() => respond(request, index)).then(resolve, reject);
      },
    };
    return query;
  }};
}
const errorCode = code => error => error instanceof NhlResearchReadError && error.code === code;
const row = (id, at = '2026-11-22T00:00:00Z') => ({id, captured_at: at});

test('pagination advances by returned rows when the server imposes a lower limit', async () => {
  const data = Array.from({length: 9}, (_, i) => row(String(i)));
  const db = fakeDb(request => ({data: data.slice(request.range[0], request.range[0] + 2), count: 9, error: null}));
  const result = await readNhlResearchPages(db, spec, {cutoff, pageSize: 6});
  assert.deepEqual(result.rows, data);
  assert.deepEqual(db.calls.map(call => call.range[0]), [0, 2, 4, 6, 8]);
  assert.equal(result.evidence.complete, true);
  assert.equal(result.evidence.pages, 5);
  assert.equal(result.evidence.expected, 9);
  for (const call of db.calls) {
    assert.deepEqual(call.filters, [['lte', 'captured_at', cutoff]]);
    assert.deepEqual(call.options, {count: 'exact'});
    assert.deepEqual(call.order, [['id', {ascending: true}]]);
  }
});

test('an exact zero count is verified empty, while null data or count is unavailable', async () => {
  const empty = await readNhlResearchPages(fakeDb(() => ({data: [], count: 0, error: null})), spec, {cutoff});
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.evidence.complete, true);
  for (const value of [{data: null, count: 0}, {data: [], count: null}, {data: [], count: -1}]) {
    await assert.rejects(readNhlResearchPages(fakeDb(() => value), spec, {cutoff}), errorCode('COUNT_UNVERIFIED'));
  }
});

test('changed counts, missing pages and overflow cannot be certified as complete', async () => {
  const changing = fakeDb((_request, index) => index ? {data: [row('b')], count: 3} : {data: [row('a')], count: 2});
  await assert.rejects(readNhlResearchPages(changing, spec, {cutoff}), errorCode('SNAPSHOT_CHANGED_DURING_READ'));
  const missing = fakeDb((_request, index) => ({data: index ? [] : [row('a')], count: 2}));
  await assert.rejects(readNhlResearchPages(missing, spec, {cutoff}), errorCode('INCOMPLETE_ARCHIVE_PAGE'));
  const overflow = fakeDb(() => ({data: [row('a'), row('b')], count: 1}));
  await assert.rejects(readNhlResearchPages(overflow, spec, {cutoff}), errorCode('ARCHIVE_COUNT_MISMATCH'));
});

test('source caps stop at the first observed excessive count', async () => {
  const db = fakeDb(() => ({data: [row('a')], count: 101}));
  await assert.rejects(readNhlResearchPages(db, spec, {cutoff}), errorCode('SOURCE_SCAN_CAPPED'));
  assert.equal(db.calls.length, 1);
  const exactCap = fakeDb(() => ({data: [row('a')], count: 1}));
  const result = await readNhlResearchPages(exactCap, {...spec, cap: 1}, {cutoff});
  assert.equal(result.evidence.complete, true);
});

test('overlapping pages and incomplete composite ordering keys are rejected', async () => {
  const repeated = fakeDb(() => ({data: [row('same')], count: 2}));
  await assert.rejects(readNhlResearchPages(repeated, spec, {cutoff}), errorCode('DUPLICATE_OR_MISSING_PAGE_KEY'));
  const composite = {...spec, order: ['event_id', 'shooting_player_id', 'goalie_id']};
  const incomplete = fakeDb(() => ({data: [{event_id: 'g', shooting_player_id: 1}], count: 1}));
  await assert.rejects(readNhlResearchPages(incomplete, composite, {cutoff}), errorCode('DUPLICATE_OR_MISSING_PAGE_KEY'));
  const distinct = fakeDb(() => ({data: [{event_id: 'g', shooting_player_id: 1, goalie_id: 2},
    {event_id: 'g', shooting_player_id: 1, goalie_id: 3}], count: 2}));
  assert.equal((await readNhlResearchPages(distinct, composite, {cutoff})).rows.length, 2);
});

test('errors and deadline aborts fail the whole page read', async () => {
  await assert.rejects(readNhlResearchPages(fakeDb(() => ({data: null, error: {code: '503'}})), spec, {cutoff}), errorCode('READ_UNAVAILABLE'));
  const controller = new AbortController(); controller.abort();
  const unused = fakeDb(() => ({data: [], count: 0}));
  await assert.rejects(readNhlResearchPages(unused, spec, {cutoff, signal: controller.signal}), errorCode('READ_TIMEOUT'));
  assert.equal(unused.calls.length, 0);
  const midRead = new AbortController();
  const timeout = fakeDb(() => { midRead.abort(); return {data: null, error: {message: 'aborted'}}; });
  await assert.rejects(readNhlResearchPages(timeout, spec, {cutoff, signal: midRead.signal}), errorCode('READ_TIMEOUT'));
  assert.equal(timeout.calls[0].signal, midRead.signal);
});

test('invalid cutoff or page sizes do not dispatch a database request', async () => {
  for (const options of [{cutoff: 'not-a-date'}, {cutoff, pageSize: 0}, {cutoff, pageSize: 1001}, {cutoff, pageSize: 1.5}]) {
    const db = fakeDb(() => ({data: [], count: 0}));
    await assert.rejects(readNhlResearchPages(db, spec, options), errorCode('INVALID_READ_REQUEST'));
    assert.equal(db.calls.length, 0);
  }
});

test('schedule body batches preserve both the fixed cutoff and exact selected IDs', async () => {
  const db = fakeDb(() => ({data: [row('a'), row('b')], count: 2}));
  await readNhlResearchPages(db, {...spec, ids: ['a', 'b'], scoreOnly: true}, {cutoff});
  assert.deepEqual(db.calls[0].filters, [['lte', 'captured_at', cutoff],
    ['like', 'source_url', 'https://api-web.nhle.com/v1/score/%'], ['in', 'id', ['a', 'b']]]);
});

test('complete archive reading uses the same cutoff across tables and never returns a partial archive', async () => {
  const db = fakeDb(() => ({data: [], count: 0}));
  const archive = await readNhlResearchArchive(db, {cutoff});
  assert.equal(db.calls.length, NHL_RESEARCH_TABLES.length);
  assert.equal(archive.readEvidence.complete, true);
  assert.equal(archive.readEvidence.cutoff, cutoff);
  assert.equal(archive.readEvidence.selectedScheduleReceipts, 0);
  for (const call of db.calls) assert.equal(call.filters[0][2], cutoff);
  for (const source of NHL_RESEARCH_TABLES) assert.deepEqual(archive[source.key], []);
  const failed = fakeDb(request => request.table === 'nhl_free_predictions_v1' ?
    {data: null, count: null, error: {code: 'missing'}} : {data: [], count: 0});
  await assert.rejects(readNhlResearchArchive(failed, {cutoff}), errorCode('READ_UNAVAILABLE'));
});

const metadata = (id, at, date = '2026-11-20', sha = 'a') => ({id, captured_at: at,
  source_url: `https://api-web.nhle.com/v1/score/${date}`, sha256: sha.repeat(64),
  http_status: '200', error: null, encoding: 'gzip/base64', access_denied: 'false'});

test('schedule selection preserves snapshots before each decision and simultaneous conflicts', () => {
  const source = [metadata('morning', '2026-11-20T10:00:00Z'),
    metadata('early-a', '2026-11-20T11:00:00Z'), metadata('early-b', '2026-11-20T11:00:00Z', '2026-11-20', 'b'),
    metadata('late', '2026-11-20T17:00:00Z'), metadata('future', '2026-11-24T00:00:00Z'),
    metadata('previous-day', '2026-11-19T12:00:00Z', '2026-11-19')];
  const decisions = [{frozen_at: '2026-11-20T12:00:00Z'}, {frozen_at: '2026-11-20T18:00:00Z'}];
  assert.deepEqual(selectNhlScheduleReceiptIds(source, decisions, cutoff), ['early-a', 'early-b', 'late', 'previous-day']);
  assert.deepEqual(selectNhlScheduleReceiptIds([...source].reverse(), [...decisions].reverse(), cutoff),
    ['early-a', 'early-b', 'late', 'previous-day']);
});

test('receipt exactly at decision cannot displace the prior strict-as-of calendar snapshot', () => {
  const source = [metadata('before', '2026-11-20T10:00:00Z'),
    metadata('equal', '2026-11-20T11:00:00Z'), metadata('later', '2026-11-20T11:30:00Z')];
  const selected = selectNhlScheduleReceiptIds(source, [{frozen_at: '2026-11-20T11:00:00Z'}], '2026-11-20T12:00:00Z');
  assert.deepEqual(selected, ['before', 'later']);
});

test('a failed latest receipt cannot hide a previous successful archived slate', () => {
  const valid = metadata('valid', '2026-11-20T10:00:00Z');
  const latest = metadata('bad', '2026-11-20T11:00:00Z');
  for (const change of [{http_status: '500'}, {error: 'TIMEOUT'}, {access_denied: true},
    {access_denied: 'true'}, {encoding: 'not-gzip'}, {sha256: 'invalid'}]) {
    assert.deepEqual(selectNhlScheduleReceiptIds([valid, {...latest, ...change}], [], cutoff), ['valid']);
  }
});

test('missing selected schedule bodies cannot produce a supposedly complete archive', async () => {
  const selected = [metadata('one', '2026-11-20T10:00:00Z'), metadata('two', '2026-11-19T10:00:00Z', '2026-11-19')];
  const db = fakeDb(request => {
    if (request.table !== 'nhl_free_source_v1') return {data: [], count: 0};
    if (request.select.includes('sha256:')) return {data: selected, count: 2};
    return {data: [selected[0]], count: 1};
  });
  await assert.rejects(readNhlResearchArchive(db, {cutoff}), errorCode('SCHEDULE_RECEIPT_MISSING'));
  const bodyQuery = db.calls.find(call => call.select === 'id,captured_at,source_url,body');
  assert.deepEqual(bodyQuery.filters.find(filter => filter[0] === 'in'), ['in', 'id', ['one', 'two']]);
});

function emptyArchive() {
  return {...Object.fromEntries(NHL_RESEARCH_TABLES.map(source => [source.key, []])), sources: [], cutoff,
    readEvidence: {complete: true, cutoff, mode: 'TEST_VERIFIED_ARCHIVE'}};
}

test('aggregate distinguishes verified empty arrays from absent or unverified archive sources', () => {
  const empty = emptyArchive();
  const report = buildNhlResearchAudit(empty, {cutoff});
  assert.equal(report.status, 'EMPTY_ARCHIVE');
  assert.equal(report.readEvidence.complete, true);
  assert.ok(report.inventory.entries.every(entry => entry.records === 0));
  assert.ok(report.moneyline.comparisons.every(model => model.games === 0 && model.brier === null));
  for (const source of [...NHL_RESEARCH_TABLES.map(item => item.key), 'sources']) {
    const missing = buildNhlResearchAudit({...empty, [source]: undefined}, {cutoff});
    assert.equal(missing.status, 'READ_UNAVAILABLE');
    assert.equal(missing.readEvidence.complete, false);
    assert.equal(missing.moneyline, undefined);
  }
  for (const readEvidence of [undefined, {complete: false, cutoff}, {complete: true, cutoff: '2026-11-22T00:00:00Z'}]) {
    assert.equal(buildNhlResearchAudit({...empty, readEvidence}, {cutoff}).status, 'READ_UNAVAILABLE');
  }
});

test('aggregate inventory and market evaluation cannot include future receipts from a superset', () => {
  const data = emptyArchive(), eventId = 'nhl:2026020350', start = '2026-11-20T01:00:00Z';
  data.predictions = [{event_id: eventId, created_at: '2026-11-24T00:00:00Z'}];
  data.outcomes = [{event_id: eventId, observed_at: '2026-11-24T00:00:00Z', body: {
    eventId, scheduledAt: start, homeId: 5, awayId: 19, homeScore: 4, awayScore: 3,
    capturedAt: '2026-11-24T00:00:00Z'}}];
  data.early = [{event_id: eventId, model_version: 'NHL_SCORES_POISSON_SHADOW_V1', status: 'FROZEN_RESEARCH',
    scheduled_at: start, frozen_at: '2026-11-19T22:05:00Z', created_at: '2026-11-19T22:05:01Z',
    source_completed_at: '2026-11-19T22:02:10Z', home_team_id: 5, away_team_id: 19,
    home_team: 'Pittsburgh Penguins', away_team: 'St. Louis Blues',
    projection: {homeGoals: 3.1, awayGoals: 2.8}, official_pick: false, production_eligible: false}];
  const quote = {eventId, scheduledAt: start, homeId: 5, awayId: 19, home: 'Pittsburgh Penguins', away: 'St. Louis Blues',
    market: 'total', book: 'CIRCA', capturedAt: '2026-11-19T22:03:00Z', marketRulesCertified: false, officialPick: false,
    quote: {market: 'total', book: 'CIRCA', readyForOfficialPicks: false, fullGameContractCertified: false,
      over: {side: 'Over', line: 6, price: -110}, under: {side: 'Under', line: 6, price: -110}}};
  data.runs = [{id: 'run', started_at: '2026-11-19T22:00:00Z', completed_at: '2026-11-19T22:04:00Z',
    detail: {marketQuoteObservations: [quote, {...quote, capturedAt: '2026-11-24T00:00:00Z'}]}}];
  const report = buildNhlResearchAudit(data, {cutoff});
  assert.equal(report.inventory.entries.find(entry => entry.key === 'predictions').records, 0);
  assert.equal(report.inventory.entries.find(entry => entry.key === 'outcomes').records, 0);
  assert.equal(report.inventory.entries.find(entry => entry.key === 'total').records, 1);
  assert.equal(report.exactMarkets.early.markets.total.pricedEvents, 1);
  assert.equal(report.exactMarkets.early.markets.total.graded, 0);
  assert.equal(report.exactMarkets.early.markets.total.modelBrier, null);
  assert.ok(report.cutoffExclusions.some(entry => entry.source === 'marketQuotes'));
  assert.ok(report.cutoffExclusions.some(entry => entry.source === 'outcomes'));
});

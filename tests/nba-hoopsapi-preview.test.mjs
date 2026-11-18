import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHoopsNbaList} from '../src/lib/nba/hoopsapi-preview-core.mjs';
import {getHoopsPreviewStatus, testHoopsPreviewOnce, HOOPS_API_PREVIEW_URL} from '../src/services/nba-hoopsapi-preview.service.mjs';
const sample = {games: [
  {game_id: 101, competition: 'NBA', home: 'Home A', away: 'Away B', start_time: '2026-11-19T00:00:00Z',
   updated_at: '2026-11-18T20:00:00Z', periods: {
     q1: {fanduel: {spread: {line: -1.5, home: 1.9, away: 1.9}, total: {line: 55.5, over: 1.87, under: 1.95},
       team_total_home: {line: 28.5, over: 1.91, under: 1.91}}, pinnacle: {total: {line: 56, over: 1.9, under: 1.9}}},
     h1: {fanduel: {total: {line: 113.5, over: 1.95, under: 1.85}}},
     ft: {fanduel: {moneyline: {home: 1.5, away: 2.6}}},
   }},
  {game_id: 102, competition: 'NBA', home: 'Home C', away: 'Away D',
   periods: {q1: {pinnacle: {total: {line: 51.5, over: 1.8, under: 2}}}}},
]};
test('normalize quarter/half quotes and exact spread orientation; no cross-book fallback', () => {
  const out = normalizeHoopsNbaList(sample, '2026-11-18T21:00:00Z');
  assert.equal(out.coverage.nba_games, 2);
  assert.equal(out.coverage.missing_fanduel_games, 1);
  assert.equal(out.coverage.normalized_quote_sides, 10);
  assert.equal(out.coverage.period_quote_sides.q1, 6);
  assert.equal(out.coverage.period_quote_sides.h1, 2);
  assert.equal(out.coverage.period_quote_sides.ft, 2);
  const away = out.quotes.find(q => q.market === 'spread' && q.side === 'away');
  assert.equal(away.line, 1.5);
  assert.equal(away.home_handicap_line, -1.5);
  assert.equal(away.regional_price_verified, false);
  assert.equal(out.quotes.some(q => q.model_probability !== null || q.recommendation !== null || q.sportsbook !== 'FanDuel'), false);
});
test('missing FanDuel is zero-quote, never invented', () => {
  const out = normalizeHoopsNbaList({games: [sample.games[1]]});
  assert.equal(out.status, 'NO_FANDUEL_QUOTES_OBSERVED');
  assert.equal(out.coverage.missing_fanduel_games, 1);
  assert.equal(out.coverage.normalized_quote_sides, 0);
});
test('bad response rejected and missing side remains missing', () => {
  assert.throws(() => normalizeHoopsNbaList({games: null}), /INVALID/);
  const out = normalizeHoopsNbaList({games: [{game_id: 1, home: 'A', away: 'B', competition: 'NBA',
    periods: {q1: {fanduel: {total: {line: 51.5, over: 1, under: 1.9}}}}}]});
  assert.equal(out.coverage.normalized_quote_sides, 1);
  assert.equal(out.coverage.rejected_selection_sides, 1);
  assert.equal(out.quotes[0].side, 'under');
});
test('status has no provider call, no writes and no scheduler', () => {
  const status = getHoopsPreviewStatus({VERCEL_ENV: 'preview', HOOPS_API_KEY: 'configured'});
  assert.equal(status.enabled, true);
  assert.equal(status.provider_calls_made, 0);
  assert.equal(status.writes_performed, 0);
  assert.equal(status.automatic_schedule_enabled, false);
});
test('a manual test makes one GET and handles provider 429', async () => {
  let calls = 0;
  const out = await testHoopsPreviewOnce({key: 'test_private_key', fetcher: async (url, options) => {
    calls += 1;
    assert.equal(url, HOOPS_API_PREVIEW_URL);
    assert.equal(options.headers.Authorization, 'Bearer test_private_key');
    return {status: 200, ok: true, text: async () => JSON.stringify(sample)};
  }});
  assert.equal(calls, 1);
  assert.equal(out.provider_calls_made, 1);
  assert.equal(out.database_writes, 0);
  const limited = await testHoopsPreviewOnce({key: 'test_private_key', fetcher: async () => ({
    status: 429, ok: false, headers: {get: () => '3600'},
  })});
  assert.equal(limited.status, 'HOOPSAPI_RATE_LIMITED');
  assert.equal(limited.retry_after, '3600');
});

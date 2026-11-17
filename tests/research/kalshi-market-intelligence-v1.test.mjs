import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, analyze } from '../../scripts/research/kalshi-market-intelligence-v1.mjs';

test('normalizes Kalshi trade in USD without treating volume as profit', () => {
  assert.deepEqual(normalize({
    trade_id: 'abc', ticker: 'TEST', created_time: '2026-11-16T18:00:00Z',
    yes_price_dollars: '0.5600', count_fp: '10.00',
    taker_outcome_side: 'yes', is_block_trade: true
  }), {
    trade_id: 'abc', ticker: 'TEST', time: '2026-11-16T18:00:00.000Z',
    yes_price: 0.56, quantity: 10, yes_notional_usd: 5.6,
    taker_outcome_side: 'yes', taker_book_side: null, is_block_trade: true
  });
});

test('rejects malformed trade rather than fabricating activity', () => {
  assert.equal(normalize({ trade_id: 'bad', created_time: 'bogus', yes_price_dollars: '0.5', count_fp: '1' }), null);
  assert.equal(normalize({ trade_id: 'bad', created_time: '2026-11-16T18:00:00Z', yes_price_dollars: '0.5', count_fp: '0' }), null);
});

test('analyzes only pregame trades; excludes trades at and after start', () => {
  const ts = ['17:30', '18:15', '18:45', '19:00', '19:30'];
  const trades = ts.map((time, i) => ({
    time: '2026-11-16T' + time + ':00.000Z', quantity: 10 + i, yes_price: 0.50 + i * 0.05
  }));
  const report = analyze(trades, Date.parse('2026-11-16T19:00:00Z'), 'yes');
  assert.equal(report.pregame_trades, 3);
  assert.equal(report.last_hour_trades, 2);
  assert.equal(report.last_hour_quantity, 23);
  assert.equal(report.last_hour_price_change, 0.05);
  assert.equal(report.resolved_result, 'yes');
  assert.equal(report.status, 'DESCRIPTIVE_ONLY');
});

test('never estimates win probabilities without pregame start', () => {
  const report = analyze([], NaN, 'not-settled');
  assert.equal(report.status, 'MISSING_GAME_START');
  assert.equal(report.resolved_result, null);
  assert.equal(report.last_hour_volume_ratio, null);
});

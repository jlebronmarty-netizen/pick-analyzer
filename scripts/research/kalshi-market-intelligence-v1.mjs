#!/usr/bin/env node
// Research-only Kalshi trade collector. No trading, production writes or credentials.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = 'https://external-api.kalshi.com/trade-api/v2';
const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const ticker = getArg('--ticker');
const out = getArg('--out', 'tmp/kalshi-market-intelligence');
const maxPages = Math.min(100, Math.max(1, Number(getArg('--max-pages', '20')) || 20));
const pregame = getArg('--pregame-start');
const gameStart = pregame ? Date.parse(pregame) : NaN;
if (!ticker || !/^[A-Za-z0-9_-]{3,120}$/.test(ticker)) {
  console.error('Usage: node scripts/research/kalshi-market-intelligence-v1.mjs --ticker TICKER --pregame-start 2026-11-16T19:00:00Z [--out tmp/kalshi-market-intelligence] [--max-pages 20]');
  process.exit(2);
}

async function request(path, params = {}) {
  const url = new URL(ROOT + path);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + url.pathname + ': ' + (await response.text()).slice(0, 140));
      return response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
}

async function getMarket(t) {
  for (const path of ['/markets/' + encodeURIComponent(t), '/historical/markets/' + encodeURIComponent(t)]) {
    try { const result = await request(path); if (result.market) return result.market; }
    catch (error) { if (!String(error).includes('HTTP 404')) throw error; }
  }
  throw new Error('Market not found in live or historical endpoints: ' + t);
}

async function pages(path, filter, pageLimit) {
  const records = [];
  const cursors = new Set();
  let cursor = '';
  let pagesRead = 0;
  for (; pagesRead < pageLimit; pagesRead++) {
    const response = await request(path, { ...filter, limit: 1000, cursor });
    if (!Array.isArray(response.trades)) throw new Error('Missing trades array from ' + path);
    records.push(...response.trades);
    const next = response.cursor || '';
    if (!next || cursors.has(next)) { cursor = ''; pagesRead++; break; }
    cursors.add(next);
    cursor = next;
  }
  return { records, pagesRead, truncated: Boolean(cursor) };
}

function normalize(trade) {
  const date = Date.parse(trade.created_time);
  const price = Number(trade.yes_price_dollars);
  const qty = Number(trade.count_fp);
  if (!trade.trade_id || !Number.isFinite(date) || !Number.isFinite(price) || !(price > 0 && price < 1) || !(qty > 0)) return null;
  return {
    trade_id: trade.trade_id, ticker: trade.ticker, time: new Date(date).toISOString(),
    yes_price: price, quantity: qty, yes_notional_usd: Number((price * qty).toFixed(4)),
    taker_outcome_side: trade.taker_outcome_side ?? trade.taker_side ?? null,
    taker_book_side: trade.taker_book_side ?? null, is_block_trade: Boolean(trade.is_block_trade)
  };
}

function analyze(trades, start, result) {
  const before = Number.isFinite(start) ? trades.filter(t => Date.parse(t.time) < start) : [];
  const recent = before.filter(t => Date.parse(t.time) >= start - 60 * 60 * 1000);
  const prior = before.filter(t => Date.parse(t.time) >= start - 2 * 60 * 60 * 1000 && Date.parse(t.time) < start - 60 * 60 * 1000);
  const count = arr => arr.reduce((sum, t) => sum + t.quantity, 0);
  const p = arr => arr.length ? arr[arr.length - 1].yes_price : null;
  return {
    status: Number.isFinite(start) ? 'DESCRIPTIVE_ONLY' : 'MISSING_GAME_START',
    resolved_result: result === 'yes' || result === 'no' ? result : null,
    pregame_trades: before.length, last_hour_trades: recent.length,
    last_hour_quantity: count(recent), previous_hour_quantity: count(prior),
    last_hour_volume_ratio: count(prior) > 0 ? Number((count(recent) / count(prior)).toFixed(3)) : null,
    last_hour_start_price: recent.length ? recent[0].yes_price : null,
    last_hour_end_price: p(recent),
    last_hour_price_change: recent.length > 1 ? Number((p(recent) - recent[0].yes_price).toFixed(4)) : null,
    note: 'Trade prints contain both buyer and seller. Taker fields do not identify an individual or prove informed trading. No model, edge or ROI validated.'
  };
}

async function main() {
  const market = await getMarket(ticker);
  const cutoff = await request('/historical/cutoff');
  const historical = await pages('/historical/trades', { ticker }, maxPages);
  const live = await pages('/markets/trades', { ticker }, maxPages);
  const byId = new Map();
  for (const trade of [...historical.records, ...live.records]) {
    const t = normalize(trade);
    if (t) byId.set(t.trade_id, t);
  }
  const trades = [...byId.values()].sort((a, b) => a.time.localeCompare(b.time) || a.trade_id.localeCompare(b.trade_id));
  const manifest = {
    experiment: 'KALSHI_MARKET_INTELLIGENCE_V1', status: 'COLLECTED_NOT_VALIDATED',
    ticker, fetched_at: new Date().toISOString(), source: ROOT,
    cutoff, market: {
      ticker: market.ticker, event_ticker: market.event_ticker, title: market.title,
      status: market.status, result: market.result, open_time: market.open_time,
      close_time: market.close_time, settlement_ts: market.settlement_ts
    },
    game_start_utc: Number.isFinite(gameStart) ? new Date(gameStart).toISOString() : null,
    pages: { historical: historical.pagesRead, live: live.pagesRead },
    truncated: historical.truncated || live.truncated,
    trade_count: trades.length, analysis: analyze(trades, gameStart, market.result)
  };
  await mkdir(out, { recursive: true });
  await writeFile(join(out, ticker + '.trades.json'), JSON.stringify(trades, null, 2));
  await writeFile(join(out, ticker + '.manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ ticker, count: trades.length, truncated: manifest.truncated, output: out, status: manifest.status }));
  if (manifest.truncated) process.exitCode = 3;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => {
  console.error('Collection failed (no results inferred):', error.message);
  process.exitCode = 1;
});

export { normalize, analyze };

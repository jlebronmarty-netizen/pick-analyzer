#!/usr/bin/env node
// Batch collection of the six public, settled NBA/NHL Kalshi contracts.
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const thisDir = dirname(fileURLToPath(import.meta.url));
const collector = join(thisDir, 'kalshi-market-intelligence-v1.mjs');
const outputDir = resolve('tmp/kalshi-market-intelligence');
const markets = [
  { league: 'NBA', ticker: 'KXNBAGAME-26NOV13GSWSAS-SAS' },
  { league: 'NBA', ticker: 'KXNBAGAME-26NOV11GSWHOU-HOU' },
  { league: 'NBA', ticker: 'KXNBAGAME-26NOV11LALMIL-LAL' },
  { league: 'NHL', ticker: 'KXNHLGAME-26NOV11TBBUF-BUF' },
  { league: 'NHL', ticker: 'KXNHLGAME-26NOV11NYRCGY-CGY' },
  { league: 'NHL', ticker: 'KXNHLGAME-26NOV11PHIEDM-EDM' },
];

await mkdir(outputDir, { recursive: true });
const results = [];
for (const { league, ticker } of markets) {
  const process = spawnSync(globalThis.process.execPath, [collector, '--ticker', ticker, '--out', outputDir, '--max-pages', '100'], {
    encoding: 'utf8', timeout: 180000, maxBuffer: 2 * 1024 * 1024
  });
  const exitCode = process.status ?? 1;
  let tradeCount = null;
  try { tradeCount = JSON.parse(process.stdout.trim().split('\n').at(-1)).count; } catch {}
  const record = { league, ticker, success: exitCode === 0, exit_code: exitCode, trade_count: tradeCount,
    error: exitCode === 0 ? null : String(process.stderr || process.error?.message || 'Unknown error').slice(0, 500) };
  results.push(record);
  console.log(JSON.stringify(record));
}
const summary = {
  status: results.every(r => r.success) ? 'DOWNLOADED_UNVALIDATED' : 'INCOMPLETE',
  generated_at: new Date().toISOString(), results,
  reminder: 'Raw trade prints are not insider evidence, executable quotes or validated predictions. No market-specific game start has been verified.'
};
await writeFile(join(outputDir, 'batch-summary.json'), JSON.stringify(summary, null, 2));
console.log('Summary:', join(outputDir, 'batch-summary.json'));
if (summary.status === 'INCOMPLETE') process.exitCode = 1;

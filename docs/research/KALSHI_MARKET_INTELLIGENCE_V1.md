# Kalshi Market Intelligence V1 — research only

Scope: public trades / historical trades for NBA and NHL moneyline markets **when a correct market ticker and verified game start time are supplied**. No automatic market matching, bet execution, production-model changes, cron, database migrations, or deployment.

## Source and safeguards
- Public Kalshi API: https://docs.kalshi.com/api-reference/market/get-trades
- Archive guidance: https://docs.kalshi.com/getting_started/historical_data
- The collector reads live and historical endpoints, deduplicates by trade_id, and records the historical cutoff and pagination truncation status.
- No API keys required. No user account or trader identity is identified. Trade volume is not directional net money; each fill has a buyer and seller.
- `taker_outcome_side` is not proof of insider trading. Price movements can reflect public information or liquidity.
- Treat records as incomplete if `truncated: true`, and do not compare post-game prints to pre-game signals.
- Markets must be verified as sports game-winner markets (not title, series, prop, or an unrelated event). Do not infer game start from market close.
- If market `result` is not literally `yes` or `no`, it is excluded from hit-rate scoring. Other settlements and cancellations require separate handling.
- CSV/JSON artifacts in `tmp/` are local only. No credentials, private transactions, or wagering.

## Run
```bash
node --test tests/research/kalshi-market-intelligence-v1.test.mjs
node scripts/research/kalshi-market-intelligence-v1.mjs --ticker VERIFIED_KALSHI_TICKER --pregame-start 2026-11-16T19:00:00Z --max-pages 20
```

Outputs: `tmp/kalshi-market-intelligence/<ticker>.trades.json` and `<ticker>.manifest.json`.

**Status:** collector implemented; production Kalshi connectivity and retrieval of actual settled NBA/NHL contracts have not been verified in this environment. No observed empirical edge, win rate, repeat-player tracking or ROI can yet be claimed.

## Next stage (not implemented in V1)
1. Verify market discovery, NBA/NHL teams, schedules and settlement semantics against official results.
2. Fetch a sufficiently complete and representative historical cohort; report coverage and missing data, not just successful matches.
3. Pre-register anomaly rules using only information available at each cutoff (e.g. 24h, 6h, 60m, 30m, 15m); calculate baseline liquidity per market.
4. Separate train/validation/forward holdout by chronological game date; cluster uncertainty at game/event level.
5. Benchmark against contemporaneous no-vig implied market probability, calibrate edge and compute realistic execution prices, fees, slippage, and closing-line value. Trade prints are not executable quotes.
6. Keep a `PASS` outcome unless out-of-sample calibration and economic lift are positive; do not auto-promote research into official Pick decisions.

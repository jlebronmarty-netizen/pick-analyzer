# BALLDONTLIE access and historical period-line check

Research-only, 2026-09-22 UTC. This follow-up supersedes earlier assumptions that the BDL credential was unavailable locally. It does not establish Vercel runtime credential placement.

## Bounded execution

The local environment contained a nonempty `BALLDONTLIE_API_KEY`. Its value was never displayed, copied into research artifacts or committed. Stored probe evidence was checked first. Each new request was reserved in an append-only sanitized ledger before execution; existing results prevent duplicate calls and uncertain failures prevent automatic retries.

Budgets: one opening-access call, then two historical-period capability calls. Actual total: **3 BALLDONTLIE calls**. The Odds API calls/credits: **0**. No raw provider responses were persisted.

| Request | Purpose | Result |
| --- | --- | --- |
| `/mlb/v1/odds/opening`, date 2025-05-15, per_page 1 | Verify current historical opening access | HTTP 200, one row; full-game moneyline/spread/total fields and opened_at |
| `/mlb/v1/games`, date 2025-05-15, per_page 1 | Resolve exact BDL game identity | HTTP 200, game ID 15611, final, date 2025-05-15T00:05:00Z |
| `/mlb/v1/odds/markets`, game_id 15611, per_page 100 | Check historical period/team market catalog | HTTP 200, zero rows, no next cursor |

The first row is only a schema/access probe: no line, price or performance claim is made from it. The provider's UTC date is preserved; it is not asserted to match an MLB local game date or any purchased FanDuel pilot game. No player matching was performed.

## Findings

**Local historical full-game opening access works.** The historical period catalog sample is empty. This one-game result does not prove that every historical BDL game is empty, but it does not supply any admissible period/team line corpus either.

The [official MLB documentation](https://mlb.balldontlie.io/#get-all-betting-markets) describes the complete catalog endpoint as current markets. Its [opening-odds endpoint](https://mlb.balldontlie.io/#get-opening-betting-odds) documents full-game opening fields; it does not document a historical period/team opening catalog. Current/in-play/final catalog prices cannot be relabeled pregame. No undocumented historical date parameter or synthetic line was introduced.

The canonical `sports_odds_snapshots` readback also has zero rows for all 16 queried period/alternate/team market keys. Small previously purchased GitHub pilots remain preserved separately. Thus the active period-market blocker is a **sufficient, timestamped historical real-line corpus**, not a missing local BDL key.

Game Totals source inspection found an existing historical consensus development surface (`mlb_totals_revisit_dev_rows_v1`) already used by earlier revisits. This access/schema probe added no admitted game-linked opening feature corpus. Preserve the prior Game Totals result; do not label consensus as a single sportsbook quote, manufacture arbitrage, or reopen known historical results as a fresh external holdout. A future opening-feature study needs its own bounded acquisition and exact event/timestamp admission before model development.

## Evidence and boundaries

- `artifacts/research/mlb_bdl_opening_access_probe_20260922.json`
- `artifacts/research/mlb_bdl_historical_period_probe_20260922.json`
- `artifacts/research/mlb_bdl_bounded_probe_ledger_20260922.jsonl`

The model experiments in `MLB_FROZEN_ARCHITECTURE_REVISITS_20260922.md` used zero provider calls. This separate capability follow-up adds three BDL calls to the session total. No Odds API credits, database DML/DDL, Official Picks writes, APOSTAR activation, tracker changes or model promotion. No additional historical Odds API acquisition is authorized.

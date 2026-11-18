# NBA FanDuel research capture

## Scope and provenance

The existing BALLDONTLIE subscription supplies data. This change captures provider observations and does not create a new forecasting model. FanDuel regional availability and the complete sportsbook catalog remain unverified.

The previous scheduled prop collector requested points, rebounds, assists and threes for at most two games within two hours of tipoff. The new collector requests `/nba/v2/odds/player_props?game_id=…&vendors[]=fanduel` once for every remaining game on the current Puerto Rico slate. `prop_type` is intentionally omitted. The documented endpoint returns the available prop types for one game without cursor pagination.

Official provider references checked on 2026-11-18:

- https://nba.balldontlie.io/#player-props
- https://www.balldontlie.io/openapi/nba.yml
- https://nba.balldontlie.io/#games
- https://nba.balldontlie.io/#player-injuries

Full-game, Q1 and the first three minutes have separate period identifiers. Unknown future provider types remain visible in raw observations with an unverified period. Over and Under retain their own price. Milestones retain `side=yes` and `PROVIDER_MILESTONE_UNVERIFIED`; no Under is invented. Missing or malformed prices and identities stay in the raw response with a reason and do not become normalized quotes.

No documented endpoint reviewed here supplies game-quarter odds, game-half odds or team-total odds. Quarter scores in `/v1/games` are historical results and must not be presented as sportsbook lines.

## Persistence and isolation

- `nba_market_snapshots_v1` and `nba_market_quotes_v1` retain normalized props through the existing archive RPC. The first envelope retains the complete parsed provider response. Large quote responses are split into batches below the existing 3,000-quote bound.
- Quote IDs incorporate provider record content, period, statistic, side, contract, line and price. An unchanged quote retains its original row; every new response has its own immutable snapshot and capture timestamp.
- Every capture claims a unique half-hour `research:*` slot in `nba_market_sync_runs_v1`, with at most 16 provider requests. A request receipt is persisted before each request. Provider failures, request bounds and incomplete scope are reported explicitly.
- Historical `/v1/games` responses are stored only under `summary.history_capture` in the research run ledger. They are not inserted into the live schedule table, whose consumers read its newest snapshots. The provider date and Puerto Rico date remain separate.
- Optional player-stat completion reuses stored complete box scores before fetching. New box scores must match final game/player/team identities and reconcile each team’s player-point sum to the final score. Existing non-null contexts are not overwritten. The 16-game batch reports remaining games separately from already available data.
- Research runs are excluded from the existing main archive status reader. The old full-game prop research consumers filter their exact period and supported statistics, so new Q1 or milestone rows cannot displace a full-game contract through deduplication.

The parsed JSON hashes on archived payloads are hashes of `JSON.stringify(payload)`. Request receipts additionally retain a hash of the response text as received. Headers and credentials are never recorded.

## Operations

The existing authenticated NBA cron captures the broad prop response after its existing model stage. It skips the previous four filtered gateway prop calls in that cron invocation. Existing manual archive behavior is preserved. The new collector never writes model probabilities, expected value, recommendations or `prediction_history`.

The existing private deployment page `/nba-market-data` has buttons to capture current props, the last 30 historical days, and missing player statistics. They POST to `/api/market-data/nba/ops?action=capture-research` with same-origin JSON. Allowed payload fields are `mode`, `startDate`, `endDate`, and, for statistics only, up to 16 `gameIds`. Historical ranges must end before the current Puerto Rico date and span at most 45 days. History has a six-page bound, player statistics an eight-page bound.

Read-only capture status: `/api/market-data/nba/ops?action=capture-status`. The response omits raw historical payloads; authorized data extraction can read them from the run ledger. Private host and Vercel request identity checks remain required. The collector also requires the existing production archive flag and server-side provider credential.

Pregame injuries and projected lineups now follow up to four pages each, with an eight-request shared cap and a persistent run claim. A failed fetch cannot report complete coverage. A fresh partial snapshot does not suppress a later bounded retry. These observations remain `usedAsScoringInput=false`.

## Read-only prediction provenance repair

Inspection found that the generic NBA prediction GET called `getModelWeights`, which initialized every default using an upsert. Thus `persist:false` protected prediction history but did not protect existing weight rows. NBA now calls the existing weight reader with `initialize:false`. The model formula and default values remain unchanged; absent weights use in-memory defaults without a database write. Other sports retain their existing invocation behavior.

After the earlier GET at 16:55:16 UTC on 2026-11-18, the five NBA weight rows had default weights and updated timestamps from that call. The NBA model-version and weight-history tables contained no prior entries, so there is no evidence for a restorative weight change. The observed checkpoint is preserved in `nba-weight-read-audit-20261118.json`. No restoration or model promotion was attempted.

## Verification status

- Nine deterministic tests passed for periods, raw provenance, O/U and milestones, malformed data, cursor completion, history dates, final box-score reconciliation and a read-only weight call that performs zero upserts.
- The two existing focused suites for prop statistical contracts and NBA schedule/Cup handling passed (nine tests).
- Full NBA GOAT and production-audit regression: 93 tests passed.
- Local Next webpack compilation and TypeScript passed. Full page-data collection is blocked by the existing `/api/ai/copilot/chat` import requiring `NEXT_PUBLIC_SUPABASE_URL`; this isolated worktree has no environment file or copied credentials. The configured Vercel build remains the deployment gate.
- Production capture counts require a separate execution receipt and are not inferred from local tests.

# MLB public historical line-source audit — 2026-09-22 UTC

State: `BLOCKED_NO_ADMISSIBLE_REGULAR_SEASON_PERIOD_LINE_CORPUS`.
Research/shadow only. No imported training corpus, Odds API calls, paid downloads, production writes, tracker edits, recommendations or external opening.

## Verified starting state

GitHub main readback: `c8aac46648b38935a6dd00f17e0987b90b042033`; open research PRs #180/#185/#186/#187 inspected or retained. PR187 starts this block at `4513de3d582f4346ed58adc20135981e590da5fd`. Vercel research previews at that head are READY; no promotion. Canonical Supabase is `ynuocvexviorgdjrfthw`; read-only schema and historical-development aggregates inspected. Existing F5 transfer remains 2/2 ATS, 9.09% coverage, insufficient sample. Previously failed candidates remain preserved.

## Licensed public sample: SharpAPI

Publisher: [SharpAPI sample repository](https://github.com/Sharp-API/SharpAPI-Sample-Data), commit `cddb647cc9d06bd244cb8b72111cb39bd5587478`, file `data/mlb_odds_snapshot.csv`, Git blob `69ca871bcd510b11c2c6679af169f022a5bbbc82`. README and LICENSE were reviewed before the single bounded file read. Data license is explicitly declared CC BY 4.0 by the publisher. This declaration is not independent certification of original sportsbook collection or authenticity. No signup, API-key request, sportsbook scraping or model ingestion occurred.

Attribution: Odds data from SharpAPI (sharpapi.io), Sports Betting Odds Sample Dataset, 2026. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Supplied without warranties. Our modification is an aggregate quality audit; raw rows are not redistributed in this repository. A quarantined local copy was used for structural checks only.

Measured 3,673 price rows, 14 source slugs (including exchanges/prediction markets, not 14 conventional sportsbooks). Most rows are futures. Exactly 28 rows explicitly name the requested cumulative F3/F5/F7 spread/total markets, across two source events and one capture date, 2026-07-13. The following counts are price rows, not independent games or settled bets.

| Market | Rows | Events | Books in target subset | Before stated start | Post-start | Admitted regular-season pregame rows |
|---|---:|---:|---|---:|---:|---:|
| F3 spread | 4 | 1 | Caesars, FanDuel | 4, all All-Star | 0 | 0 |
| F5 spread | 6 | 1 | Bookmaker | 0 | 6 | 0 |
| F7 spread | 2 | 1 | FanDuel | 2, all All-Star | 0 | 0 |
| F3 totals | 4 | 1 | Caesars, FanDuel | 4, all All-Star | 0 | 0 |
| F5 totals | 10 | 2 | Bookmaker, FanDuel | 2, all All-Star | 8 | 0 |
| F7 totals | 2 | 1 | FanDuel | 2, all All-Star | 0 | 0 |
| Explicit team totals / alternate team totals | 0 | 0 | None identified | 0 | 0 | 0 |

The 14 regular-game target rows concern Giants/Rockies: stated start July 12 at 20:05Z, capture July 13 at 01:45:57Z, over five hours later. `is_live=False` does not establish pregame status. All 14 timestamp-prestart rows name American League/National League, an exhibition outside the certified regular-season population. Caesars and FanDuel list that event one minute apart; no authoritative MLBAM join was attempted.

Line fidelity: F5 spread values include ±0.5 and ±1; exact side/line values exist, but there is no main-versus-alternate designation. F3/F7 spread values are ±0.5 in the exhibition. Cumulative period slugs are distinct from `3rd_inning_moneyline` / `7th_inning_moneyline`, which must never be relabeled cumulative F3/F7. Generic `game_prop`/`binary` rows are not inferred to be team totals. Cross-book identifiers, pricing authenticity, original book update timestamps and settlement rules remain uncertified. No accuracy, ROI, EV or CLV is computed.

Reproducible offline audit: `scripts/research/audit_mlb_public_snapshot_v1.mjs`; aggregate result: `artifacts/research/mlb_public_snapshot_audit_20260922.json`. The command verifies the reviewed upstream Git blob after restoring CRLF transport normalization. It fails closed for unreviewed source bytes. This is an audit of this pinned snapshot, not an ingestion approval or generic data admission tool.

## Other sources reviewed; no dataset ingestion

| Source | Evidence and coverage | Decision / blocker |
|---|---|---|
| [SBR existing PR180](https://github.com/jlebronmarty-netizen/pick-analyzer/pull/180) | Actual latest run [35670890352](https://github.com/jlebronmarty-netizen/pick-analyzer/actions/runs/35670890352), job106566846502, succeeded. Its final scope was a three-request schema probe on 2025-04-15 F5 totals, not the earlier 19-request PR-body plan. Page lists 15 games; one game was resolved for GraphQL; opening/current records both 0; all odds views null. Artifact10671345159. | No usable lines in that probe. Reused logs; no new SBR requests, bulk crawl or inference of season-wide absence. |
| [VSiN public PDF](https://vsin.com/wp-content/uploads/2024/06/MLB-2024-92.pdf) | Two pages, June16/17 2024; visible cumulative first-five totals/ML and fullgame runlines; June16 page includes final scores. | No verifiable quote capture-before-start or reviewed data reuse grant. Public visibility and a printed opening-lines note are insufficient. Metadata/visible document audit only, no archive scraper, no training rows. Fullgame runline column is not F5 spread. |
| [Kaggle MLB Odds Data](https://www.kaggle.com/datasets/christophertreasure/major-league-baseball-vegas-data) | Catalog describes 2012–2021 fullgame closing ML/totals/runline; license field is Other; original odds provenance not established. | No demonstrated target-period/team-total corpus. Description-only review; no download or reliance on an implied license. |
| [Hugging Face Oronto dataset card](https://huggingface.co/datasets/Oronto/mlb-game-prediction-data/blob/main/dataset-card.md) | MIT-labeled card claims 2000–2024 MLB and Vegas odds; upstream odds sources unspecified. | MIT label does not certify upstream odds rights or period timestamps. Metadata only; not admitted. |
| [ProbWin F5 catalog](https://en.probwin.com/data-shop/mlb-f5-odds/) | Advertises Pinnacle F5 totals, 6,735 games, paid download, sourced via historical Odds API. Listed schema lacks capture timestamp; catalog dates/coverage statements need clarification. | Paid corpus outside free search. No purchase, free-preview rows not a usable corpus, no assumption of redistribution rights. |
| [ParlayAPI public datasets](https://api.parlay-api.com/datasets) | Public downloadable frozen sample is NFL, outside scope; unauthenticated MLB demo is current ML. Historical closing CSV costs provider credits; target-period coverage and access terms not established. | No MLB historical target corpus obtained; no signup, paid/API call or unlicensed ingestion. |
| [TickFoundry MLB catalog](https://tickfoundry.com/data/series/mlb) | Claims Polymarket 2026 tick data and five free market-days; earlier portion attributed to a licensed archive. | Contract/token order books are not automatically exact sportsbook F3/F5/F7/team-total markets. Reuse terms, mapping and target coverage unverified. No sample claim/download. |
| [MLB Odds Scraper code](https://github.com/vile319/mlb_odds_scraper) | MIT software for OddsPortal collection, including stealth/concurrency features. | Software license is not a license to upstream odds. Not run; no aggressive scraping or bypass. |
| [Retrosheet CSV schema](https://www.retrosheet.org/downloads/csvoverview.html) | Player/game/line-score/outcome data through 2025. | Useful outcomes/features, not evidence of historical bookmaker period lines. Existing certified outcomes reused separately. |

Existing BDL result remains bounded: opening endpoint accessible, one historical markets catalog empty. See `MLB_BDL_ACCESS_AND_LINE_BLOCKER_20260922.md`; no repeat BDL call here. Existing 16-key stored-line audit remains zero; small purchased pilots are separate and insufficient. Searches are bounded and cannot prove no suitable corpus exists anywhere.

## Admission requirements and continuation

Before any future training import: establish data reuse rights and upstream provenance; exact game identities and regular-season population; explicit cumulative period, market, team/side and handicap; sportsbook and original timestamp strictly before actual start; no FULL/postgame substitutions; immutable payload/hash and deterministic exact joins; measured missingness, seasons/months, duplicate books/quotes and target settlement rules. Alternate labels and exact lines must be supplied, not guessed. Existing development/external gates remain unchanged.

No source in this audit supplies an admissible sufficient corpus. Authorized continuation was executed on already-certified period outcomes: the separately frozen Davidson rating architecture, documented in `MLB_PERIOD_DAVIDSON_V1_CLOSEOUT.md`. No public sample rows were used. All development gates failed, including F7 despite aggregate 77.61%, because monthly stability failed; external stays closed.

Next required evidence for line markets is a licensed, timestamped regular-season corpus with exact cumulative period lines. The unresolved catalogs above require provenance/access clarification before use; no such messages were sent. Further model revisions require a separately justified new information source or architecture and a new freeze; do not adjust this candidate's K, confidence, draw prior or month filter to rescue it.

Validation: upstream sample blob identity verified; 28 target rows reconcile to 14 post-start plus 14 pre-start exhibition rows. Eight offline tests PASS. npm.cmd run build PASS, exit0, 400 static pages, CI placeholder configuration; no live build credentials. Exporter source readback remains unconditional410 for F5 v5 and threshold v2.

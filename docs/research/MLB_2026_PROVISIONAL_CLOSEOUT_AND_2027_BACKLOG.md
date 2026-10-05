# MLB 2026 provisional closeout and 2027 backlog

Status: RESEARCH / SHADOW ONLY. Verification performed 2026-10-05 UTC; user-local reporting date 2026-10-04.
This is a provisional regular-season closeout. Postseason capture and settlement remain open.
Canonical tracker: MLB_MARKET_MODEL_TRACKER.md, authoritative 2026-10-04 section (PR #266).
No model, threshold, Official Picks, APOSTAR, production promotion or provider budget changes.

## Verified repository state
| Repository | main commit verified |
| --- | --- |
| Pick Analyzer | 6864ca8caf9f9399f320c1b905220fb8ea8b93bb |
| Pick Edge | d1d1924c8af48900901c0117867d7862032ff7b3 |
| Equilizer | c79a76c1621eaa3900ed955cfee78329b3c07365 |
| Pulpy | 83f7b10c2ab8b5ce34bbc84a2406b433f7182a0b |

Pulpy #19 and Pick Analyzer #265/#266 are merged. Do not repeat their repairs/imports.
These SHAs are observation anchors, not instructions to roll back concurrent work.

## Read-only integrity validation
- Master ledger: 639 rows; 488 REGULAR_SEASON and 151 POSTSEASON.
- Zero research/production/Official Picks/APOSTAR flag violations.
- Zero late freezes; zero missing freeze/start timestamps.
- Zero season-phase/game-type mismatches or postseason evidence-label violations.
- Exact-line ledger: six rows; zero latest_prior_date >= tracking_date, fewer-than-five prior starts, or late-freeze violations.
- Existing main tests: 20/20 pass across master ledger, external import, postseason compatibility and postseason history materialization.
- These checks are stored-evidence/code-contract validation, not a completed live full-pipeline dry-run or full application build.

## Separate postseason scoreboard
| Exact contract | W | L | OPEN | Settled hit rate |
| --- | ---: | ---: | ---: | ---: |
| Doubles UNDER 0.5, projection <=0.16 | 111 | 9 | 18 | 92.50% |
| Walks UNDER 0.5, projection <=0.20 | 6 | 0 | 0 | 100.00% |
| Pitcher K OVER 3.5, projection >=4.25 | 0 | 1 | 0 | 0.00% |
| Pitcher Outs OVER 14.5, projection >=15.75 | 1 | 3 | 1 | 25.00% |
| HOME +1.5 alternate frozen contract | 1 | 0 | 0 | 100.00% |

Small samples remain descriptive. Do not substitute these hit rates for calibrated per-play probabilities or EV.
Do not pool different contracts or regular-season and postseason rows.
Michael King O14.5 remains OPEN in the observed ledger; no outcome inferred here.

## Regular-season closeout
- Equilizer original E2 cohort: 130, 77-53 (59.23%), no open rows. REGULAR_SEASON_COHORT_TRUNCATED_INCOMPLETE_N130. Playoffs cannot complete 150 or unlock the original evaluator.
- Pick Edge PE_ML_V1: 75 observations, 37 WIN / 21 LOSS / 1 VOID / 16 OPEN. Top-side evaluation only; recommendation=false.
- Pick Analyzer: 283 rows, 196 WIN / 43 LOSS / 44 OPEN.
- Keep missing exact outcomes OPEN. Resolve only from each source's authoritative settlement.
- Pulpy Sep27 remains immutable PARTIAL/ineligible; meta-training gate stays CLOSED.

## Next-slate dry-run gate
At verification, pick2_mlb_games contains two Oct4 D targets, with scheduled status, and no Oct5/Oct6 targets.
Therefore next-slate runtime readiness is NOT certified.
Required sequence when a genuine future slate is available:
1. Verify authoritative schedule and persist exact gamePk/game_type through the existing preflight.
2. Check starters, exact MLBAM identities and strict-prior feature lineage; no same-date history.
3. Inspect real exact market/line/direction quotes under existing budget guards.
4. Run existing shadow evaluators in their supported dry-run/read-only mode; never run a writing cron as a substitute.
5. Verify Pulpy completeness and PARTIAL-before-hard-stop zero-write behavior.
6. Confirm frozen timestamps precede first pitch, then source-authoritative settlement and idempotent master import.
7. Archive run provenance and explicit blocked/empty results; never retro-freeze missing captures.

## Open PR review
Pick Analyzer open PR search returned #253, #229, #228, #227, #226, #225, #224, #223, #222, #221, #219, #218, #217, #216, #215, #214, #213, #212, #211 and #210.
This search is an observed page, not guaranteed exhaustive inventory.
- #219 is draft and conflicted; it retains distinct historical findings. Do not automatically close or merge.
- Pick Edge #74 is open and conflicted. Its removal of main-push path filters is NOT present in current settlement workflow. It is not proven superseded; recovery hardening requires a fresh focused review.
- Equilizer and Pulpy open-PR searches returned none.
- Before closing any PR, compare every changed file and historical artifact to current main; title similarity is insufficient. Preserve unique immutable evidence.

## Prioritized 2027 backlog
| Priority | Deliverable | Admission / acceptance gate |
| --- | --- | --- |
| P0 | Prospective schedule recovery and capture observability | Missed schedules visible; recovery refuses post-first-pitch freezes; immutable artifacts and budget guards |
| P0 | Settlement completeness | Exact gamePk/player outcome lineage; VOID rules explicit; missing outcomes remain OPEN |
| P0 | Full next-slate pipeline rehearsal | Real future slate, quotes, strict-prior inputs, completeness, immutable freeze and source settlement |
| P1 | Frozen season/cohort registry | Development, untouched external, regular forward and postseason domain-shift explicitly separated |
| P1 | Market availability | Exact lines/sides and sportsbook menus; availability measured separately from model qualification |
| P1 | Probability calibration | Prospective held-out calibration before per-play probability or EV; historical hit rate never substituted |
| P1 | New Equilizer prospective protocol | New predeclared cohort; no reuse of incomplete 2026 cohort to claim final PASS |
| P2 | Pulpy meta readiness | Common frozen multi-engine observations and predeclared training/admission gates before training |
| P2 | New architecture research | Predeclare development/evaluation gates; preserve failed architectures; no threshold rescue from 2026/playoffs |

Final 2026 closeout requires postseason completion, authoritative settlement inventory, documented unresolved OPEN rows, and immutable archive provenance. Until then this document remains provisional.

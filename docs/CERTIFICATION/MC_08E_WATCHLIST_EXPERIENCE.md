# MC-08E-R Evidence-First Watchlist Experience Certification

Status: PRODUCTION_CERTIFIED

MC-08E-R resumes the paused MC-08E work after P2.4 production certification and creates the `watchlist_v1` homepage presentation contract.

## Preservation Evidence

- Recovery branch: `recovery/mc-08e-paused-2026-08-04`.
- Recovery commit: `84083538f4a2932b24c09c98aa3138817c9116c6`.
- External patch: `C:\Users\jlebr\AppData\Local\Temp\pick-analyzer-mc08e-recovery\mc-08e-paused-8408353.patch`.
- Patch SHA256: `0BAA406D265C307743E6E40D2A4F97E1EFBED9C4021161D3BD491A4359926397`.
- Original checkout destructive commands: none.
- Paused unrelated files remain excluded from the integration commit.

## Certification Scope

- Homepage Watchlist only.
- Current stored Today evidence only.
- Current V2 Production epoch only.
- Evidence-first states: `ACTIONABLE`, `BEST_AVAILABLE_RESEARCH`, `WATCH`, `BLOCKED`, `UNAVAILABLE`, `NO_CURRENT_EVIDENCE`.
- No provider calls.
- No remote mutations.
- No scheduler, settlement, learning, recommendation-policy or model changes.

## Product Contract

The Watchlist now explains what is worth monitoring, why it is not a primary decision yet, what would promote it, what would remove it and whether the limiting factor is price, freshness, value, confidence, policy or evidence. It is bounded to five current items and never fills the homepage with historical, post-start, unsupported-market or low-information rows.

Rent Play and Moneyline unavailable states use evidence-first labels: `Best Rent Play Candidate`, `No Current Rent Play Evidence`, and `Best Moneyline Candidate`.

## Local Evidence

MC-08A, MC-08B, MC-08C, MC-08D, MC-08E-R and Mission Control validators passed. JSON validation, Markdown validation, changed-file ESLint, targeted secret scan, git diff --check and production build passed.

## Production Evidence

Production serves commit `17c44f35081f199d61094704d29bc8b897850c87`. Read-only certification returned HTTP 200 for `/api/system/version`, `/`, `/api/dashboard/today`, `/api/current-board?mode=current&limit=200`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200`, `/api/operations/health`, `/betting-workbench`, `/game-intelligence` and `/mlb-operations`. Rendered desktop and mobile homepage checks passed with `watchlist_v1`, five observed Watchlist items and no horizontal overflow.

## Final Classification

MC_08E_R_DEPLOYED_AND_CERTIFIED.

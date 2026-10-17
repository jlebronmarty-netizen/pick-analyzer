# Reviewed MLB no-action closure — 2026-10-17

Status: **CLOSED_CONDITIONAL_RESEARCH_ACCOUNTING**. All 73 previously OPEN observations received a reviewed VOID disposition under an explicitly stated public-rule reference policy. This is not certification of settlement or a refund on an executed bookmaker ticket.

## Decision and evidence

| Evidence | Observations | Research disposition |
| --- | ---: | --- |
| Not in the exact game's complete official starting lineup | 61 | VOID, did not start |
| Started but explicitly recorded zero plate appearances | 1 | VOID, no batter appearance |
| Never started on the original local scheduled day; postponed to another day | 11 | VOID, postponed before start |

The 61 non-starters comprise 59 roster entries without batting statistics and two substitutes with zero PA. The remaining zero-PA player, Miguel Rojas, was a starter, so his disposition uses the appearance requirement rather than incorrectly calling him a non-starter.

`review.py` independently reopens the prior SHA256-verified raw archive. Each final game's roster contains all nine original starters on both teams. A missing statistic is never converted to zero: the 59 non-starter decisions use lineup identity, independently of missing PA data. The single zero-PA starter is supported by explicit official `plateAppearances=0`.

For game 849817, the original start was 2026-10-17T00:00:00Z, which is October 16 in Cleveland. The official schedule retains that postponed entry and links the replacement start on October 18 through `rescheduledFrom`. This is postponement before any play, not a started postseason game interrupted mid-game. The separate 90-day postseason interruption rule is not used to keep these original-day props open.

## Rule-reference policy and material limitation

The Massachusetts regulator publishes a BetMGM rulebook approved November 20, 2025, effective November 24, 2025, and a DraftKings rulebook dated August 18, 2025, both predating the observations. BetMGM's baseball player-prop section requires starting and an appearance for action. DraftKings' baseball rules define batter participation by PA, require starting/participating for pregame player props, and void a game that does not start on its originally scheduled local day.

- [BetMGM reference, printed page 15](https://massgaming.com/wp-content/uploads/BetMGM-House-Rules-11.24.25.pdf)
- [DraftKings reference, printed pages 32 and 35](https://massgaming.com/wp-content/uploads/DraftKings-House-Rules-8.18.25.pdf)

**The quote vendor does not identify jurisdiction or prove the rules attached to an executed ticket.** Therefore this review explicitly applies `MLB_REVIEWED_NO_ACTION_RESEARCH_V1` as conditional research accounting under a US-MA public reference. Both `originalQuoteJurisdictionCertified` and `actualBookSettlementCertified` remain false. The UI labels each newly closed row “VOID condicional research” and says that the original contract is uncertified. No claim of certified actual-book settlement, cash refund, executable ROI or historical jurisdiction coverage is made.

The primary PDFs were inspected through web retrieval. A separate terminal request to the regulator for the BetMGM PDF returned HTTP403; no original PDF bytes were retained or hashed. `rule-sources.json` records the acquisition limitation and paraphrased reference rules rather than claiming a raw document archive. No new MLB API acquisition or paid API call was made; the 35-game raw archive from the prior repair was reused.

## Applied data repair and verification

Four immutable review jobs hold the 73 individually reviewed identities, reasons, official-response hashes, rule references and policy scope. `closure.sql` updates only previously OPEN prop settlements and corresponding OPEN master rows, in one guarded transaction. The prior blockers and proof remain in settlement identity metadata. Missing/void actual values remain NULL.

The master ledger remains **851 observations: 615 WIN, 161 LOSS, 75 VOID, zero OPEN**. Seventy-three VOID are new conditional dispositions; the two older VOID are untouched. Regular Pick research stays **196 W / 43 L, 82.01%**, now with 44 VOID instead of 44 OPEN. Postseason batter-doubles keeps **277 W / 26 L, 91.42%**, now with 29 VOID instead of 29 OPEN. Regular batter-doubles remains **168 W / 33 L, 83.58%**. Regular batter-walks remains **14 W / 4 L, 77.78%**. No phase or contract is pooled and no W/L denominator changes.

`verification.json` confirms exact preservation of all frozen master columns, original approved-prop rows, all previously settled master/prop rows (including the two Run Line WIN from the earlier repair), and Official Picks. The canonical production API returns AVAILABLE and zero OPEN; all 73 new labels explicitly disclose the conditional research scope. Existing settlement guards skip settled rows, so normal synchronization cannot reopen them. No automatic VOID default was introduced for future unknown contracts.

This is a data review and audit-only source change. Application code, frozen models, RLS, crons, workers and deployment configuration are unchanged. Existing production reads the repaired database directly; no application release is needed to display it.

Reproduce the offline review with `python research/mlb-no-action-review-20261017/review.py`. Regenerate the exact evidence-insert statements and guarded SQL with `prepare-sql.py`. **Do not rerun closure.sql against an already repaired cohort**: its count and hash gates intentionally reject changed input. Any later ticket-specific adjudication requires a new explicit review of these conditional dispositions with the original contract evidence; it must preserve this audit.

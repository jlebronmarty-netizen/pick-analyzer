# Acquisition review — BSN 2027 preparation

Existing permitted input for this pilot: the 38 previously stored
`public.sport_events` rows, exported read-only with metadata preserved. Date
range 2026-06-19–2026-07-17 Puerto Rico. No new production data imported.

The user reports a March 2027 start; public reporting specifies March 20:
https://www.elnuevodia.com/deportes/baloncesto/notas/cuando-vuelve-el-bsn-la-liga-fija-la-fecha-para-el-inicio-de-la-temporada-2027/
This is planning context, not a fixture list.

| Candidate | Finding | Decision |
|---|---|---|
| BSN official site/app | Existing source inventory requires approved permissioned export or attested operator CSV. Website terms prohibit unauthorized mass extraction. | No historical scraping. |
| Scoutbasketball | Public index lists historical BSN seasons; terms prohibit automated extraction and unapproved commercial use. | Discovery only. No data downloaded for the pilot. |
| Livesport / Flashscore | Public BSN season archives found. No open dataset license or approved export established in this review. | Discovery only; not a bulk source. |
| Oddspedia | Public result/odds pages found. No usable licensed pregame archive established. | Not a source for this pilot. |
| Kalshi KXBSNGAME | One current-markets probe returned zero; one documented historical-markets probe returned five rows with a continuation cursor. Winner contracts exist for 2026. | No further paging or model use: data-use/retention rights and exchange-contract semantics need separate certification. It is not sportsbook ML. |
| API-Basketball | Documented league coverage endpoint exists. BSN and season-specific entitlement not verified without an account response. | Potential future free-plan coverage audit; no subscription or call made. |

References:
- https://wp.bsnpr.com/terminos-y-condiciones/
- https://scoutbasketball.com/terms-of-service
- https://www.livesport.com/basketball/puerto-rico/bsn/archive/
- https://oddspedia.com/es/baloncesto/puerto-rico/bsn
- https://docs.kalshi.com/api-reference/historical/get-historical-markets
- https://kalshi.com/developer-agreement
- https://api-sports.io/documentation/basketball/basketball-v1.yaml

Next useful input is complete licensed/open seasons or a permissioned operator
export. Keep source, season, phase, event date, team IDs, scores, revisions and
rights reference. Price files need separate exact market, direction, bookmaker,
decimal price and observation/start timestamps. Do not manufacture prices from
results or mix an exchange contract with sportsbook ML ROI.

The pilot does not prove that no free dataset exists. These are the sources
checked, with their specific unverified requirements.

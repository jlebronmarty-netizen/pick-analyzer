# Personalization Contract V1

Contract: `personalization_v1`

## Fields

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| language | EN / ES | EN | Display-language foundation for product chrome. |
| appearance | SYSTEM / LIGHT / DARK | SYSTEM | Client-side theme preference. |
| timezone | supported IANA timezone | America/Puerto_Rico | User display timezone only. |
| oddsFormat | AMERICAN / DECIMAL | AMERICAN | Price display only. |
| preferredSports | string[] | baseball_mlb | Presentation preference. |
| preferredTeams | canonical team refs | [] | Presentation preference where identities exist. |
| homepageDensity | COMPACT / COMFORTABLE | COMFORTABLE | Homepage spacing preference. |
| showAdvancedEvidence | boolean | false | Collapsed technical evidence visibility. |

## Persistence

The release uses localStorage key `pick-analyzer.personalization.v1`. Values are normalized on read and write, bounded to supported options and safe defaults. Invalid values are ignored.

## Canonical Time

The canonical operating timezone remains `America/Puerto_Rico`. User timezone changes only affect date display. They do not regroup Performance rows, alter operating-day selection or change scheduler behavior.

## Presentation-Only Boundary

The contract is intentionally outside prediction, settlement, provider and scheduler services. It must not be used as an input to model scoring, recommendation policy, Official Picks, Kelly sizing, settlement, learning or provider acquisition.

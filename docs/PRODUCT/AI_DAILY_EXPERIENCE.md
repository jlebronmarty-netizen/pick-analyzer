# AI Daily Betting Experience

Status: RELEASE 09 PRODUCT EXPERIENCE

Release 09 turns the opening screen into a morning betting brief. It presents existing intelligence only. It does not change prediction logic, probability calibration, Official Pick policy, settlement, scheduler behavior, provider contracts or historical data.

## Homepage Experience

The homepage now starts with an AI Daily Brief that answers:

- Is today a good betting day?
- Which games deserve attention?
- Which games should be avoided?
- Why?
- How confident is the AI?
- What changed since yesterday or since the latest model evidence?

## Daily Recommendation

The Daily Recommendation is presentation-only:

| Recommendation | Display Rule |
| --- | --- |
| BET TODAY | At least one stored candidate passed existing Official Pick policy. |
| LIMITED OPPORTUNITIES | Stored value or best-opportunity evidence exists, but Official Pick policy does not certify a broad betting day. |
| NO STRONG EDGE TODAY | Current stored evidence does not expose a qualified edge. |

No confidence is fabricated. Missing metrics display as unavailable.

## Top Picks

Existing Rent Play, Moneyline Bet, Parlay Builder and Today's Best Opportunity cards now show:

- teams or matchup
- market
- predicted probability
- confidence
- AI explanation from existing blockers/evidence
- supporting evidence
- model version when exposed by current APIs

## No Bet Experience

The No Bet Watch section surfaces existing caution reasons:

- insufficient edge
- non-positive EV
- stale or missing evidence
- unsupported or blocked data
- explicit avoid/do-not-act wording from existing evidence

## Model Evolution Panel

The Model Evolution panel summarizes Release 08 status:

- settled sample
- approved candidates
- rejected candidates
- waiting candidates

It is read-only and does not promote any optimization.

## Source APIs

- `/api/dashboard/today`
- `/api/current-board`
- `/api/model/intelligence`
- `/api/performance`

Provider calls: 0 during certification.

Database mutations: 0 during certification.

# Soccer Competition Activation Gate V1

Generated: 2026-07-28T03:53:11.396Z

Commit: `8f97779ec66ee20e9e751aac7f789c982c76e5a0`

Status: SOCCER_COMPETITION_PREVIEW_BLOCKED

## Evidence

- Provider calls made: 0
- Remote mutations made: 0
- Production mutations made: 0
- Active provider soccer competition keys: 67
- Aggregate soccer score endpoint HTTP status: 404
- Stored The Odds API soccer odds rows: 260
- Sampled stored odds rows: 260
- Distinct stored soccer event IDs in odds rows: 8
- Stored competition keys observed: soccer, soccer_generic
- Stored markets: moneyline, spread, total
- Stored bookmakers: 8
- Provider event mappings: 0
- Canonical soccer events: 0
- Soccer completed result rows: 0
- Engine fixture predictions: 10
- Engine persistence enabled: false

## Gates

| Gate | Result | Blocker |
| --- | --- | --- |
| Competition-scoped provider catalog | PASS |  |
| Aggregate soccer endpoint rejected for lifecycle activation | PASS |  |
| Stored soccer odds | PASS |  |
| Stored odds expose event identifiers | PASS |  |
| Stored odds expose competition scope | BLOCKED | SOCCER_STORED_COMPETITION_SCOPE_NOT_CERTIFIED |
| Exact event identity | BLOCKED | SOCCER_CANONICAL_EVENT_CROSSWALK_NOT_CERTIFIED |
| Canonical soccer events | BLOCKED | SOCCER_CANONICAL_EVENTS_EMPTY |
| Scheduled future starts | BLOCKED | SOCCER_FUTURE_CANONICAL_EVENTS_EMPTY |
| Historical results | BLOCKED | SOCCER_COMPLETED_RESULTS_EMPTY |
| Competition feature readiness | BLOCKED | SOCCER_FEATURES_PARTIAL_ONLY |
| Cutoff safety | PASS |  |
| Persistence enabled for real preview rows | BLOCKED | SOCCER_PERSISTENCE_DISABLED_BY_DESIGN |
| Settlement inputs | BLOCKED | SOCCER_SETTLEMENT_INPUTS_EMPTY |
| Learning labels | BLOCKED | SOCCER_SETTLED_LEARNING_SAMPLE_EMPTY |
| Preview/production separation | PASS |  |

## Verdict

Soccer remains blocked from Preview prediction activation. Stored odds are real but must not be promoted into a global soccer product surface because competition identity, canonical event mapping, completed result evidence, settlement inputs and production-safe persistence are not certified.

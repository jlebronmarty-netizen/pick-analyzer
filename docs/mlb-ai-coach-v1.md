# MLB AI Coach V1

## Route

`GET /api/mlb/ai-coach?query=why%20is%20TEX%20Moneyline%20not%20official&includeValidation=true`

The coach is deterministic. It does not call an LLM, does not call providers, does not mutate data and does not change official-pick policy.

## Supported Questions

- Why is TEX Moneyline not official?
- What has positive EV?
- Which data is missing?
- What changed since the last refresh?
- What should be refreshed next?
- Which games improve most after pitcher confirmation?
- Why no bet?

## Current Answers

TEX Moneyline remains preview-only despite positive EV because blockers include production gate, quarantine, insufficient calibration, low confidence, low model probability and 0% critical data completeness.

The coach reports 2 current positive-value previews:

- TEX Moneyline
- MIA Moneyline

Both remain non-official.

## Guardrails

- providerCallsMade: 0
- remoteMutationsMade: 0
- llmUsed: false
- fabricatedData: false
- officialPolicyChanged: false

# MC-08F Personalization Experience V1

Status: LOCAL VALIDATION PASS - DEPLOYMENT PENDING

## Scope

MC-08F adds a bounded personalization layer for presentation preferences only. It introduces language foundation, appearance preference, display timezone, odds format, preferred sports, preferred teams, homepage density and advanced-evidence visibility.

## Contract

Contract version: `personalization_v1`

Persistence: anonymous browser localStorage using `pick-analyzer.personalization.v1`.

Authenticated profile persistence was audited but not implemented in this package because no reliable existing user-profile settings persistence was present. The UI documents local persistence honestly and preserves all betting data if local preferences are reset.

## Product Surfaces

- Homepage reads display preferences, timezone, odds format, density and advanced-evidence visibility.
- Performance reads display timezone, language foundation and preferred sport default selection when no URL sport is supplied.
- Settings exposes a safe preference editor at `/settings`.

## Guardrails

MC-08F does not change prediction formulas, probability, confidence, ranking, Official Pick policy, Rent Play policy, Moneyline policy, Smart Parlay logic, Kelly, settlement, learning, scheduler, provider contracts or provider budgets.

Preferred sports and teams are display and prioritization hints only. They do not alter model output or recommendation eligibility.

## Certification Plan

Local certification requires the MC-08F validator, product validators, ESLint, JSON validation, Markdown validation, targeted secret scan, git diff check and build. Production certification requires read-only verification of `/api/system/version`, homepage, Performance, Current Board, Today, Most Likely, Best Value, Betting Workbench and Game Intelligence.

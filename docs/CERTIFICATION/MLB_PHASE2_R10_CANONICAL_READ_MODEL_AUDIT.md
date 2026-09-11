# R10 canonical freshness and classification

Local read-model repair is validated; deployment readback is pending. This phase does not claim to repair the separate unresolved prediction-stage automation failure.

## Inventory and source of truth

Today, Value Board and the operations API share `getMlbOperationalView`. Data Health also consumes that view. Native `pick2_mlb_games` supplies current-slate identities and baseline status; `sports_teams` supplies names. Champion `pick2_game_predictions` joins by game; values and Official Picks join by the selected prediction and game; market observations join through `pick2_mlb_market_event_mappings` and exact stored observation references.

The prior projection used native `updated_at` as a fifteen-minute game freshness proxy. Reusing an unchanged native row therefore hid later successful evidence. It also selected evaluation time globally per game rather than per side and lacked explicit canonical game/opportunity status separation.

The repaired server-only reader reads the existing private schedule evidence store through its existing adapter. Reservation, envelope, digest, timestamp and run-freeze checks verify each observed schedule; no new provider acquisition, raw store, grant or mutation is introduced. Only compact observed game facts reach the projection. Private envelopes and runtime references are never returned to clients.

Game freshness uses verified schedule observation time, a coherent certified prediction freeze, or a fully linked pregame value evaluation that passed the existing runtime guards. A value can attest freshness only when its prediction, both observations, mapping, bookmaker, acquisition/evaluation times, starts and starters agree. Native mutation time is not used. The original fifteen-minute age boundary remains. Market age still uses the existing provider-last-update freshness engine. Missing/unreadable schedule evidence fails closed; genuinely aged evidence remains stale.

## Selection and supersession

Prediction ordering is canonical timestamp followed by deterministic identity. Creation-time bounds prevent historical reads from importing later-created rows. Values are selected for that prediction separately per side at the latest evaluation time. The current price is from the newest observed acquisition; invalid new acquisitions or unmatched new markets cannot silently fall back to an older favorable evaluation. Mappings, observation IDs and pregame cutoffs are independently checked. Official Picks must match the current value, prediction, game, policy and decision time. Policy V1, probability, price, edge and EV calculations are unchanged.

An older blocker is superseded only by newer coherent evidence. Old rows and decisions are never rewritten. Game state is READY, WAITING_FOR_EVIDENCE, BLOCKED, STARTED or FINAL. Opportunity state is OFFICIAL_PICK, VALUE_CANDIDATE, WATCHLIST, BLOCKED or NO_EDGE. The unchanged UI continues grouping NO_EDGE under Watchlist; the shared canonical `opportunity_status` distinguishes it for a later UI phase. Both surfaces consume the same projection. No new recommendations or decisions are created by classification.

## Reconciliation and validation

Private replay of preserved R9 evidence at its original readback produces eight Official Picks, three Value Candidates, thirteen Watchlist rows and two blocked rows. Twenty-four stale-native blockers were superseded; two old temporal blockers also carried old-market blockers. This replay is not a production refresh or retroactive mutation.

The fresh R10 baseline instead contains two started-game blocks and twenty-four old-market blocks: time has elapsed and automation has encountered a later prediction-stage failure. It would be incorrect to apply the historical replay's freshness to the current board. All fifteen games remain present, with available canonical probabilities and prices and only current blockers.

Seventeen focused regression cases verify native-time independence, blocker supersession, deterministic ties, per-side selection, exact joins, newest-market guards, pick ownership, starter changes, unknown starters, genuine aging, unavailable evidence, started/final states and canonical parity. The existing seventeen-case automation/settlement/readiness regression also passes. No provider calls or production DML/DDL occur in R10. Test fixtures are disposable only; detailed production evidence remains outside Git.

The separate production `PREDICTIONS` / `CANONICAL_GUARD_FAILURE` is preserved and must be investigated under a separate operational repair. No automation, model, feature, policy or runtime write-path change is part of R10.

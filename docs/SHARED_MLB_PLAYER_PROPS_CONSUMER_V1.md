# Shared MLB player-props Consumer V1

GET `/api/consumer/v1/mlb/player-props?gamePk=<MLB game_pk>` returns original provider quote evidence only. It performs no provider acquisition or mutation and needs no interactive login.

Response: `{version,status,asOf,data}`. Available quotes contain canonicalGamePk, providerEventId, targetStart, pitcherProviderId, pitcherMlbamId, pitcherName, market, selection, line, sportsbookKey, sportsbookName, americanOdds, providerLastUpdate, acquiredAt, sourcePayloadDigest, sourceResponseDigest and allowlisted provenance.

Only `SHARED_MLB_PLAYER_PROP_QUOTE_V1` records from the existing `sports_odds_snapshots` table, marked `shared_evidence_only`, enter this endpoint. Supported market: pitcher_strikeouts. Rows must have complete identity/provenance and original line/price, agree with their immutable stored representation, remain pregame and pass the ten-minute provider/acquisition freshness limit at response time. No probabilities, projections, fair odds, edge, EV or recommendations are substituted.

No eligible rows returns HTTP 200, `NO_FRESH_CERTIFIED_QUOTES`, and an empty array. Invalid gamePk returns 400; excessive scope returns 422; database failure returns 503. Responses disable caching. Non-GET mutation methods are not implemented.

Persistence is separate: an authorized bounded insert uses a deterministic content identity. Identical data is reused; conflicting stored rows fail closed. The endpoint itself cannot persist, refresh or revive expired evidence. A successful historical insertion does not promise an indefinitely nonempty feed.

No schema migration, privileged mutation endpoint, model change, scheduler change or historical flag change is part of this implementation.

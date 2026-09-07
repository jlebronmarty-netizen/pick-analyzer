# MLB First-Inning Feature Semantics Audit V1

Status: `LEGACY_FIELD_SEMANTICS_NOT_SAFE_FOR_MODELING`

The legacy `pick2_mlb_first_inning_daily_features.team_first_inning_scoring_rate` field must not be used as a scoring-rate feature.

A production read-only reconciliation against the canonical Statcast pitch table showed that the stored values match average first-inning pitches seen by the offense, not first-inning scoring frequency. Example for the 2026-08-01 TB vs CWS target:

- stored away value (CWS): `18.201835`
- independently reconstructed CWS average first-inning pitches seen before 2026-08-01: `18.201835`
- actual CWS first-inning scoring frequency before that date: about `32.11%`
- stored home value (TB): `16.954128`
- independently reconstructed TB average first-inning pitches seen before 2026-08-01: `16.954128`
- actual TB first-inning scoring frequency before that date: about `33.03%`

The same exact-value pattern was reproduced for SEA, MIN, SD and SF examples.

Therefore the field name is semantically incorrect even though the underlying value is deterministic. It is quarantined from NRFI/YRFI modeling.

NRFI/YRFI V1 must instead derive labels and prior-date features directly from `pick2_raw_mlb_statcast_pitches`, using only games with `source_game_date < target_game_date`. Same-day earlier games are not permitted as source history for a later same-day target.

No Official Pick, betting-market activation, sportsbook call, or provider call is authorized by this audit.

# Shared MLB Results Consumer V1

GET `/api/consumer/v1/mlb/results?season=2025&limit=100&cursor=0` returns `{version,status,asOf,data,total,nextCursor}`. Follow nextCursor until null. Limit is 1–250; the only certified season is 2025. POST is unavailable. Responses are no-store.

The read-only product covers 2,430 identities: 2,278 eligible outcome labels and 152 blocked records. Each stored historical row must match its certified projection digest. Missing, duplicate or changed source evidence fails the page closed with HTTP 503. No production eligibility flag is modified.

Rows include gamePk, game_date, scheduled_at, home_team, away_team, final_home_score, final_away_score, official_final_status, source, source_lineage, training_eligible, training_eligibility_reason and blockers. Blocked rows deliberately have null score fields rather than presenting uncertified scores as canonical. Classification counts: 18 result conflicts, 39 incomplete, 95 other validation failures.

Official retained final status proves final state and identity; scores derive from Retrosheet corroborated by Savant. This is outcome-label admission only. It proves neither pregame feature availability nor any engine's experiment split membership. asOf is response time, not historical availability.

The committed structural authority contains identities, timestamps, classifications and digests, not raw score samples. Scores are read from existing production storage. No model outputs, new tables, grants, privileged mutation endpoint or business DML are introduced. The player-props route is unchanged.

Validation: authority replay, production-source digest parity, paginated HTTP validation, rejected query/write methods, build. Commands: `node scripts/shared-mlb-results-authority.mjs`, `node --env-file=.env.local scripts/shared-mlb-results-readback.mjs`, `node scripts/shared-mlb-results-http-validate.mjs [baseUrl]`.

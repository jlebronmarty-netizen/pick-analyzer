# MLB engine hub — October 14

Review branch: `feat/mlb-engine-hub`. Production remains on the previously approved PR 270 release.

The hub at `/mlb/overview` organizes recorded MLB selections into General, Pick, Edge, Equilizer and Formula views. Links are available from Today, Qualified Plays and the existing MLB Research Lab. The current research source is `mlb_2026_forward_master_ledger_v1`; the independent official card reuses the existing deduplicated Official Pick performance reader. No recommendation/model/settlement logic is copied or changed.

Research accuracy is WIN/(WIN+LOSS), with OPEN/PUSH/VOID excluded. Regular season and postseason remain separate. Each model/engine/exact market/line/direction/contract/evidence group has its own metrics. Engine subtotals are descriptive accounting, not calibrated probabilities, executable ROI or unique bets. Formula view shows the same observations without creating another engine. Equilizer postseason does not extend the original cohort. PE_ML_V1 remains artifact-direction evidence, never an Official Pick.

The history includes selection, game identifier, target date, frozen projection, observed result/value and freeze/settlement timestamps. Filters by engine, exact formula, phase, date and result apply to history; cards and formula accuracy intentionally retain the full selected phase. History uses 25 rows per page. OPEN does not imply an active market. Projection values retain each model's native units and do not become per-play probabilities. Raw metadata, source pointers, model probabilities and sportsbook fields are not serialized in the new history DTO.

The guarded complete snapshot reader retains exact count/watermark, stable cursor, duplicate and as-of checks. Additional display fields are opt-in and validated. A missing/invalid/changed/partial ledger fails closed. Read-only `/api/mlb/engines` supplies the same sanitized DTO as the server-rendered page. Sources are read concurrently and no client-side provider requests or N+1 queries are introduced.

Canonical SQL audit: 815 master observations, 16 exact groups, no missing target date/selection/game identifier, no nonfinite projection. Snapshot fingerprint at audit: `f42af747f961b1453852180f509639f9`. Counts are a snapshot, not hardcoded display metrics. Only synced canonical forward observations are included; no claim of all historical formula availability, backtest/forward pooling, or retroactive prediction creation.

Verification so far: 32 dashboard logic/render tests PASS; targeted ESLint PASS; release readiness guard PASS with all 107 operational pins unchanged. Local production build and configured preview review are recorded below after completion. No database writes, migrations, provider acquisitions, scheduler changes, production merge or deployment by this change.

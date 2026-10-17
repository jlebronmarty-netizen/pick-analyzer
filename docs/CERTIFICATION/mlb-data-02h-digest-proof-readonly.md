# MLB_DATA_02H historical digest proof — read only

Audit branch only. Do not merge.

This branch temporarily runs `scripts/mlb-data-02h-digest-proof-readonly.mjs` before the normal Vercel preview build. The script performs only GET requests to the MLB Stats API and SHA-256 calculations. It contains no Supabase client, no database credentials, and no database mutation code.

Purpose: reproduce the exact `sha256(stable(game))` contract from the certified MLB_DATA_02H writer before any September 7 native-game write is permitted.

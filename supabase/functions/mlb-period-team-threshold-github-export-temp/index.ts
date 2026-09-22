import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const CONTRACT = "MLB_PERIOD_TEAM_THRESHOLD_GITHUB_EXPORT_V1/1.0.0";
const AUDIENCE = "supabase-period-team-threshold";
const REPOSITORY = "jlebronmarty-netizen/pick-analyzer";
const MAX_DATE = "2026-09-18";
const JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

const FEATURE_COLUMNS = [
  "season","game_pk","game_date","home_team","away_team","venue","day_night",
  "feature_cutoff_date","pregame_integrity_tier","home_games_prior","away_games_prior",
  "home_win_pct","away_win_pct","home_runs_scored_pg","home_runs_allowed_pg",
  "away_runs_scored_pg","away_runs_allowed_pg","home_run_diff_pg","away_run_diff_pg",
  "home_pyth_win_pct","away_pyth_win_pct","home_home_win_pct","away_away_win_pct",
  "home_l5_win_pct","away_l5_win_pct","home_l5_runs_scored_pg","home_l5_runs_allowed_pg",
  "away_l5_runs_scored_pg","away_l5_runs_allowed_pg","home_l5_run_diff_pg","away_l5_run_diff_pg",
  "home_l10_win_pct","away_l10_win_pct","home_l10_runs_scored_pg","home_l10_runs_allowed_pg",
  "away_l10_runs_scored_pg","away_l10_runs_allowed_pg","home_l10_run_diff_pg","away_l10_run_diff_pg",
  "home_off_ops_proxy","away_off_ops_proxy","home_off_iso","away_off_iso",
  "home_off_bb_pct","away_off_bb_pct","home_off_k_pct","away_off_k_pct",
  "home_sc_off_hard_hit_pct","away_sc_off_hard_hit_pct","home_sc_off_barrel_pct","away_sc_off_barrel_pct",
  "home_off_l5_ops_proxy","away_off_l5_ops_proxy","home_off_l5_bb_pct","away_off_l5_bb_pct",
  "home_off_l5_k_pct","away_off_l5_k_pct","home_off_l5_hard_hit_pct","away_off_l5_hard_hit_pct",
  "home_vs_sp_hand_hit_rate","away_vs_sp_hand_hit_rate","home_vs_sp_hand_hr_rate","away_vs_sp_hand_hr_rate",
  "home_vs_sp_hand_bb_rate","away_vs_sp_hand_bb_rate","home_vs_sp_hand_k_rate","away_vs_sp_hand_k_rate",
  "home_sp_hand","away_sp_hand","home_sp_starts_prior","away_sp_starts_prior",
  "home_sp_ra9","away_sp_ra9","home_sp_whip","away_sp_whip","home_sp_k9","away_sp_k9",
  "home_sp_bb9","away_sp_bb9","home_sp_k_pct","away_sp_k_pct","home_sp_bb_pct","away_sp_bb_pct",
  "home_sp_avg_ip_per_start","away_sp_avg_ip_per_start","home_sp_hr_per_pa","away_sp_hr_per_pa",
  "home_sp_whiff_rate","away_sp_whiff_rate","home_sp_csw_rate","away_sp_csw_rate",
  "home_sp_hard_hit_pct","away_sp_hard_hit_pct","home_sp_barrel_pct","away_sp_barrel_pct",
  "home_sp_l5_ra9","away_sp_l5_ra9","home_sp_l5_whip","away_sp_l5_whip",
  "home_sp_l5_k_pct","away_sp_l5_k_pct","home_sp_l5_bb_pct","away_sp_l5_bb_pct",
  "home_sp_l5_avg_ip","away_sp_l5_avg_ip","home_prev_bullpen_ra9","away_prev_bullpen_ra9",
  "home_rest_days","away_rest_days","home_games_last_7d","away_games_last_7d",
  "home_travel_miles_48h","away_travel_miles_48h","home_timezone_changes_48h","away_timezone_changes_48h"
];

async function verifyGithubOidc(req: Request) {
  const token = (req.headers.get("x-github-oidc-token") || "").trim();
  if (!token) throw new Error("OIDC_MISSING");
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "https://token.actions.githubusercontent.com",
    audience: AUDIENCE,
  });
  if (payload.repository !== REPOSITORY) throw new Error("OIDC_REPOSITORY_MISMATCH");
  if (payload.repository_owner !== "jlebronmarty-netizen") throw new Error("OIDC_OWNER_MISMATCH");
  const ref = String(payload.ref || "");
  if (!ref.startsWith("refs/heads/research/period-team-threshold-classifier-v1-20260921")) {
    throw new Error("OIDC_REF_MISMATCH");
  }
  return payload;
}

function json(body: unknown, status=200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {"Content-Type":"application/json","Cache-Control":"no-store"},
  });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return json({status:"METHOD_NOT_ALLOWED"},405);
    await verifyGithubOidc(req);

    const body = await req.json().catch(()=>({}));
    const mode = String(body?.mode || "");
    const offset = Math.max(0, Number(body?.offset || 0));
    const limit = Math.min(250, Math.max(1, Number(body?.limit || 250)));
    if (!["f5_margin","team_runs"].includes(mode)) return json({status:"INVALID_MODE"},400);

    const url = Deno.env.get("SUPABASE_URL") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !service) throw new Error("SUPABASE_SERVER_CREDENTIALS_MISSING");
    const db = createClient(url, service, {auth:{persistSession:false,autoRefreshToken:false}});

    const selectCols = FEATURE_COLUMNS.join(",");
    const { data: features, error: featureError } = await db
      .from("mlb_ml_xyear_features_v1")
      .select(selectCols)
      .in("season",[2025,2026])
      .lte("game_date",MAX_DATE)
      .order("season",{ascending:true})
      .order("game_date",{ascending:true})
      .order("game_pk",{ascending:true})
      .range(offset, offset + limit - 1);
    if (featureError) throw new Error("FEATURE_QUERY:"+featureError.message);

    const rows = Array.isArray(features) ? features : [];
    const keys = rows.map((r:any)=>Number(r.game_pk)).filter(Number.isFinite);
    let outcomes: any[] = [];

    if (keys.length) {
      if (mode === "f5_margin") {
        const {data,error} = await db.from("mlb_f5_ml_revisit_base_v1")
          .select("season,game_pk,game_date,home_f5,away_f5")
          .in("game_pk",keys)
          .in("season",[2025,2026])
          .lte("game_date",MAX_DATE);
        if (error) throw new Error("F5_OUTCOME_QUERY:"+error.message);
        outcomes = data || [];
      } else {
        const {data,error} = await db.from("mlb_ml_xyear_game_v1")
          .select("season,game_pk,game_date,home_score,away_score")
          .in("game_pk",keys)
          .in("season",[2025,2026])
          .lte("game_date",MAX_DATE);
        if (error) throw new Error("TEAM_OUTCOME_QUERY:"+error.message);
        outcomes = data || [];
      }
    }

    const outcomeMap = new Map(outcomes.map((r:any)=>[`${r.season}:${r.game_pk}`,r]));
    const exported:any[] = [];
    for (const row of rows as any[]) {
      if (String(row.feature_cutoff_date || "") >= String(row.game_date || "")) continue;
      const out = outcomeMap.get(`${row.season}:${row.game_pk}`);
      if (!out) continue;
      if (mode === "f5_margin" && (out.home_f5 == null || out.away_f5 == null)) continue;
      if (mode === "team_runs" && (out.home_score == null || out.away_score == null)) continue;
      exported.push({
        ...row,
        ...(mode === "f5_margin"
          ? {target_home_f5:Number(out.home_f5),target_away_f5:Number(out.away_f5)}
          : {target_home_runs:Number(out.home_score),target_away_runs:Number(out.away_score)})
      });
    }

    return json({
      contract: CONTRACT,
      mode,
      historicalMaxGameDate: MAX_DATE,
      offset,
      limit,
      scannedRows: rows.length,
      rows: exported,
      hasMore: rows.length === limit,
      researchOnly: true,
      providerCallsMade: 0,
      oddsApiHistoricalCreditsConsumed: 0,
      officialPicksWrites: 0,
      apostarActivation: false,
      productionPromotion: false,
    });
  } catch (error) {
    return json({
      contract: CONTRACT,
      status:"FAILED",
      error:error instanceof Error ? error.message : String(error),
      researchOnly:true,
      providerCallsMade:0,
      oddsApiHistoricalCreditsConsumed:0,
      officialPicksWrites:0,
      apostarActivation:false,
      productionPromotion:false,
    },500);
  }
});

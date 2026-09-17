import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const RESEARCH_BRANCH = 'research/totals-2025-historical-backfill'
const PAGE_SIZE = 500

const FIELDS = [
  'game_pk',
  'game_date',
  'day_night',
  'doubleheader_flag',
  'pregame_integrity_tier',
  'data_completeness_pct',
  'open_total',
  'close_total',
  'open_over_price',
  'open_under_price',
  'close_over_price',
  'close_under_price',
  'opening_sportsbook_count',
  'closing_sportsbook_count',
  'avg_team_runs_scored_pg',
  'avg_team_runs_allowed_pg',
  'avg_venue_split_runs_scored_pg',
  'avg_venue_split_runs_allowed_pg',
  'avg_l5_runs_scored_pg',
  'avg_l5_runs_allowed_pg',
  'avg_l10_runs_scored_pg',
  'avg_l10_runs_allowed_pg',
  'h2h_total_runs_pg_prior',
  'h2h_games_prior',
  'avg_off_ops_proxy',
  'avg_off_iso',
  'avg_off_bb_pct',
  'avg_off_k_pct',
  'avg_off_hard_hit_pct',
  'avg_off_barrel_pct',
  'avg_off_exit_velocity',
  'avg_off_l5_ops_proxy',
  'avg_off_l5_hr_per_pa',
  'avg_off_l5_hard_hit_pct',
  'avg_vs_sp_hand_hr_rate',
  'avg_vs_sp_hand_k_rate',
  'avg_vs_sp_hand_hard_hit_pct',
  'avg_sp_ra9',
  'avg_sp_whip',
  'avg_sp_k_pct',
  'avg_sp_bb_pct',
  'avg_sp_hr_per_pa',
  'avg_sp_hard_hit_pct',
  'avg_sp_barrel_pct',
  'avg_sp_ip_per_start',
  'avg_sp_l5_ra9',
  'avg_sp_l5_whip',
  'avg_sp_l5_hard_hit_pct',
  'avg_sp_vs_opp_hard_hit_pct',
  'avg_sp_vs_opp_k_pct',
  'avg_arsenal_matchup_score',
  'avg_bullpen_ra9',
  'avg_bullpen_whip',
  'avg_bullpen_k_pct',
  'avg_bullpen_bb_pct',
  'avg_bullpen_l7_ra9',
  'avg_bullpen_l7_whip',
  'avg_bullpen_pitches_last_2d',
  'avg_lineup_ops_proxy',
  'avg_lineup_k_pct',
  'avg_lineup_hard_hit_pct',
  'avg_lineup_barrel_pct',
  'park_runs_pg_prior',
  'temperature_f',
  'wind_mph',
  'wind_direction',
  'precip',
  'sky',
  'roof_status',
  'avg_rest_days',
  'avg_games_last_7d',
  'avg_travel_miles_48h',
  'close_over_label',
].join(',')

export async function GET() {
  const ref = process.env.VERCEL_GIT_COMMIT_REF ?? ''
  if (ref !== RESEARCH_BRANCH) {
    return NextResponse.json({ error: 'RESEARCH_ROUTE_DISABLED' }, { status: 404 })
  }

  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_totals_model_2025_v1')
      .select(FIELDS)
      .gte('game_date', '2025-04-01')
      .lt('game_date', '2025-10-01')
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      return NextResponse.json(
        { error: 'TOTALS_V6_DATASET_QUERY_FAILED', detail: error.message },
        { status: 500 },
      )
    }

    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  const nonPushRows = rows.filter((row) => row.close_over_label === 0 || row.close_over_label === 1)

  return NextResponse.json(
    {
      contract: 'MLB_TOTALS_V6_NONLINEAR_DATASET/1.0.0',
      researchOnly: true,
      branch: RESEARCH_BRANCH,
      sourceTable: 'mlb_totals_model_2025_v1',
      period: { from: '2025-04-01', to: '2025-09-30' },
      target: 'close_over_label',
      forbiddenFeatureFields: ['total_runs', 'open_total_margin', 'close_total_margin'],
      officialPicksWrites: 0,
      apostarActivation: false,
      rowCount: rows.length,
      nonPushRowCount: nonPushRows.length,
      rows: nonPushRows,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  )
}

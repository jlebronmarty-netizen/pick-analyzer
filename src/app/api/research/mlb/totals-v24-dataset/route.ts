import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const RESEARCH_BRANCH = 'research/totals-2025-historical-backfill'
const PAGE_SIZE = 500

export async function GET() {
  const ref = process.env.VERCEL_GIT_COMMIT_REF ?? ''
  if (ref !== RESEARCH_BRANCH) {
    return NextResponse.json({ error: 'RESEARCH_ROUTE_DISABLED' }, { status: 404 })
  }

  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_totals_v24_ml_dataset_2025_v1')
      .select('*')
      .gte('game_date', '2025-04-01')
      .lt('game_date', '2025-09-01')
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      return NextResponse.json(
        { error: 'TOTALS_V24_DATASET_QUERY_FAILED', detail: error.message },
        { status: 500 },
      )
    }

    const pageRows = (data ?? []) as unknown as Record<string, unknown>[]
    rows.push(...pageRows)
    if (!data || data.length < PAGE_SIZE) break
  }

  const labeled = rows.filter(
    (row) => row.close_over_label === 0 || row.close_over_label === 1,
  )

  return NextResponse.json(
    {
      contract: 'MLB_TOTALS_V24_ML_DATASET/1.0.0',
      researchOnly: true,
      branch: RESEARCH_BRANCH,
      sourceTable: 'mlb_totals_v24_ml_dataset_2025_v1',
      period: { from: '2025-04-01', to: '2025-08-31' },
      target: 'close_over_label',
      forbiddenFeatureFields: [
        'total_runs',
        'home_runs',
        'away_runs',
        'actual_winner',
        'y_margin',
        'actual_offense_score',
        'actual_contact_score',
        'actual_starter_vulnerability_score',
        'actual_bullpen_vulnerability_score',
      ],
      officialPicksWrites: 0,
      apostarActivation: false,
      rowCount: labeled.length,
      rows: labeled,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function refreshMlbStatcastDailyAnalytics() {
  const startedAt = new Date().toISOString()

  const global = await supabaseAdmin.rpc('refresh_mlb_statcast_all_analytics')
  if (global.error) throw new Error(`STATCAST_ANALYTICS_REFRESH_FAILED:${global.error.message}`)

  const props = await supabaseAdmin.rpc('refresh_mlb_pitcher_prop_research_rollups')
  if (props.error) throw new Error(`PITCHER_PROP_RESEARCH_REFRESH_FAILED:${props.error.message}`)

  return {
    success: true,
    analyticsRefreshed: true,
    matchupRollupsDeferred: true,
    nrfiResearchRollupsDeferred: true,
    providerCalls: 0,
    sportsbookProviderCalls: 0,
    officialPickWrites: 0,
    startedAt,
    completedAt: new Date().toISOString(),
  }
}

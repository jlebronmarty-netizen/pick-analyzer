import { supabase } from '@/lib/supabase'
import { TeamStats } from '@/types/database'

export async function getTeamStats(
  sportKey = 'baseball_mlb'
): Promise<TeamStats[]> {
  const { data, error } = await supabase
    .from('team_stats')
    .select('*')
    .eq('sport_key', sportKey)
    .order('win_percentage', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as TeamStats[]
}

export async function getTeamStatsByName(
  teamName: string,
  sportKey = 'baseball_mlb'
): Promise<TeamStats | null> {
  const { data, error } = await supabase
    .from('team_stats')
    .select('*')
    .eq('team_name', teamName)
    .eq('sport_key', sportKey)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as TeamStats | null
}
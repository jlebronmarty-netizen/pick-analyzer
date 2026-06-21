import { supabase } from '@/lib/supabase'
import { Sport } from '@/types/database'

export async function getSports(): Promise<Sport[]> {
  const { data, error } = await supabase
    .from('sports')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(
      `${error.message || 'Unknown Supabase error'} | ${error.details || ''} | ${error.hint || ''}`
    )
  }

  return (data ?? []) as Sport[]
}
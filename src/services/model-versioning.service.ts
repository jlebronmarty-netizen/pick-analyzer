import { supabaseAdmin } from '@/lib/supabase-admin'

export type ModelVersion = {
  id?: string
  sport_key: string
  version: number
  calibration_score: number
  roi: number
  win_rate: number
  sample_size: number
  weights: Record<string, number>
  created_at?: string
}

function round(value: number) {
  return Number(value.toFixed(2))
}

export async function saveModelVersion({
  sportKey,
  calibrationScore,
  roi,
  winRate,
  sampleSize,
  weights,
}: {
  sportKey: string
  calibrationScore: number
  roi: number
  winRate: number
  sampleSize: number
  weights: Record<string, number>
}) {
  const { data: latest } = await supabaseAdmin
    .from('model_versions')
    .select('version')
    .eq('sport_key', sportKey)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const version = Number(latest?.version ?? 0) + 1

  const payload: ModelVersion = {
    sport_key: sportKey,
    version,
    calibration_score: round(calibrationScore),
    roi: round(roi),
    win_rate: round(winRate),
    sample_size: sampleSize,
    weights,
  }

  const { data, error } = await supabaseAdmin
    .from('model_versions')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as ModelVersion
}

export async function getLatestModelVersion(sportKey: string) {
  const { data, error } = await supabaseAdmin
    .from('model_versions')
    .select('*')
    .eq('sport_key', sportKey)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return data as ModelVersion | null
}

export async function getModelHistory(sportKey: string, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from('model_versions')
    .select('*')
    .eq('sport_key', sportKey)
    .order('version', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []) as ModelVersion[]
}

export async function getModelVersionComparison(sportKey: string) {
  const history = await getModelHistory(sportKey, 20)

  const latest = history[0] ?? null
  const previous = history[1] ?? null

  if (!latest) {
    return {
      latest: null,
      previous: null,
      status: 'NO_DATA',
      changes: null,
      history,
    }
  }

  if (!previous) {
    return {
      latest,
      previous: null,
      status: 'BASELINE',
      changes: null,
      history,
    }
  }

  const roiChange = round(latest.roi - previous.roi)
  const winRateChange = round(latest.win_rate - previous.win_rate)
  const calibrationChange = round(
    latest.calibration_score - previous.calibration_score
  )
  const sampleChange = latest.sample_size - previous.sample_size

  const score =
    roiChange * 0.45 +
    winRateChange * 0.35 +
    calibrationChange * 0.2

  const status =
    score > 1
      ? 'IMPROVING'
      : score < -1
        ? 'DECLINING'
        : 'STABLE'

  return {
    latest,
    previous,
    status,
    changes: {
      roiChange,
      winRateChange,
      calibrationChange,
      sampleChange,
      score: round(score),
    },
    history,
  }
}
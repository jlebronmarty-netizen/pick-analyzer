import { runAutoModelTuning } from '@/services/model-learning.service'
import { getModelVersionComparison } from '@/services/model-versioning.service'

function shouldRunSelfLearning({
  sampleSize,
  force,
}: {
  sampleSize: number
  force?: boolean
}) {
  if (force) return true

  return sampleSize >= 25
}

function getDecision({
  previousStatus,
  sampleSize,
  roi,
  winRate,
}: {
  previousStatus: string
  sampleSize: number
  roi: number
  winRate: number
}) {
  if (sampleSize < 25) {
    return {
      promoted: false,
      reason: 'Insufficient sample size for automatic promotion.',
    }
  }

  if (roi >= 0 && winRate >= 50) {
    return {
      promoted: true,
      reason: 'Model performance is acceptable for promotion.',
    }
  }

  if (previousStatus === 'NO_DATA') {
    return {
      promoted: true,
      reason: 'Baseline model created because no previous version existed.',
    }
  }

  return {
    promoted: false,
    reason: 'Model performance did not meet promotion criteria.',
  }
}

export async function runSelfLearningEngine({
  sportKey = 'baseball_mlb',
  force = false,
}: {
  sportKey?: string
  force?: boolean
} = {}) {
  const before = await getModelVersionComparison(sportKey)

  const latestBefore = before.latest
  const sampleBefore = Number(latestBefore?.sample_size ?? 0)

  if (!shouldRunSelfLearning({ sampleSize: sampleBefore, force })) {
    return {
      success: true,
      sportKey,
      skipped: true,
      reason:
        'Self learning skipped because the model does not have enough settled sample size yet.',
      before,
      generatedAt: new Date().toISOString(),
    }
  }

  const tuning = await runAutoModelTuning(sportKey)
  const after = await getModelVersionComparison(sportKey)

  const latest = after.latest

  const decision = getDecision({
    previousStatus: before.status,
    sampleSize: Number(latest?.sample_size ?? 0),
    roi: Number(latest?.roi ?? 0),
    winRate: Number(latest?.win_rate ?? 0),
  })

  return {
    success: true,
    sportKey,
    skipped: false,
    promoted: decision.promoted,
    reason: decision.reason,
    before,
    tuning,
    after,
    generatedAt: new Date().toISOString(),
  }
}
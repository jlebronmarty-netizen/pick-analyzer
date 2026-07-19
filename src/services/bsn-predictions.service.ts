import { getBsnShadowPredictionEngine } from '@/services/bsn-shadow-prediction-engine.service'

export async function generateBsnPredictions(options?: { saveHistory?: boolean }) {
  return getBsnShadowPredictionEngine({ includeValidation: options?.saveHistory === true })
}

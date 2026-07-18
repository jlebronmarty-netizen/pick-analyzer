import { runBsnPredictionEngineV7 } from '@/services/bsn-platform.service'

export async function generateBsnPredictions(options?: { saveHistory?: boolean }) {
  return runBsnPredictionEngineV7({
    dryRun: true,
    confirmed: false,
    idempotencyKey: options?.saveHistory ? 'legacy-save-history-request-blocked' : null,
  })
}

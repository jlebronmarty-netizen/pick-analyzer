import fs from 'node:fs'

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const { getHistoricalLearningFoundationV1 } = await import('../src/services/historical-learning-foundation-v1.service.ts')

const result = await getHistoricalLearningFoundationV1()
fs.writeFileSync('docs/HISTORICAL_LEARNING_READINESS_V1.json', `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify({
  success: result.success,
  mode: result.mode,
  totalPredictionsScanned: result.inventory.totalPredictionsScanned,
  productionTrainingReady: result.inventory.productionTrainingReady,
  rejectedRows: result.inventory.rejectedRows,
  deterministicFingerprint: result.deterministicFingerprint,
  providerCallsMade: result.providerCallsMade,
  databaseMutations: result.databaseMutations,
  modelWeightHistoryBefore: result.noTrainingProof.modelWeightHistoryBefore,
  modelWeightHistoryAfter: result.noTrainingProof.modelWeightHistoryAfter,
}, null, 2))

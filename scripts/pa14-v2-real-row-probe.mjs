const { materializePa14V2RealBazRow } = await import('../src/services/pa14-v2-real-evidence.service.ts')

try {
  const result = await materializePa14V2RealBazRow()
  console.log(`PA14_V2_REAL_ROW_PROBE=${JSON.stringify(result)}`)
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.error(`PA14_V2_REAL_ROW_PROBE_ERROR=${message}`)
}

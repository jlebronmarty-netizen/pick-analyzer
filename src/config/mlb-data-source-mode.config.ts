export type MlbDataSourceMode =
  | 'SPORTSDATAIO'
  | 'DUAL_READ'
  | 'MLB_OFFICIAL_PRIMARY'

export const MLB_DATA_SOURCE_MODE_CONFIG = {
  configVersion: 'mlb_data_source_mode_v1',
  defaultMode: 'DUAL_READ' as MlbDataSourceMode,
  rollbackMode: 'SPORTSDATAIO' as MlbDataSourceMode,
  officialProvider: 'mlb_stats_api',
  legacyProvider: 'sportsdataio',
  promotionRequiresHumanAuthorization: true,
  sportsDataIoRetainedForRollback: true,
} as const

export function normalizeMlbDataSourceMode(value: unknown): MlbDataSourceMode {
  const mode = String(value ?? '').trim().toUpperCase()
  if (mode === 'MLB_OFFICIAL_PRIMARY') return 'MLB_OFFICIAL_PRIMARY'
  if (mode === 'SPORTSDATAIO') return 'SPORTSDATAIO'
  return 'DUAL_READ'
}

export function getMlbDataSourceMode(): MlbDataSourceMode {
  return normalizeMlbDataSourceMode(process.env.MLB_DATA_SOURCE_MODE)
}

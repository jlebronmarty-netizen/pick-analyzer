import type { ProductStatus } from '@/config/product-status'

export type SportsCenterSportKey = 'mlb' | 'nba' | 'nfl' | 'soccer' | 'bsn' | 'nhl' | 'tennis' | 'ufc'

export type SportsCenterCapability = {
  label: string
  status: ProductStatus
  route: string | null
  summary: string
}

export type SportsCenterSport = {
  key: SportsCenterSportKey
  sportKey: string
  label: string
  status: ProductStatus
  productReadiness: string
  dataState: ProductStatus
  modelState: ProductStatus
  todayState: ProductStatus
  summary: string
  currentHealth: string
  dataFreshness: string
  providerHealth: string
  todaysGames: string
  settlementPipeline: string
  certifiedSurfaces: string[]
  hiddenSurfaces: SportsCenterCapability[]
  capabilities: SportsCenterCapability[]
  blockers: string[]
  nextAction: string
}

export type SportsCenterReport = {
  mode: 'sports_center_v1'
  generatedAt: string
  readOnly: true
  providerCallsMade: 0
  remoteMutationsMade: 0
  productionMutationsMade: 0
  sports: SportsCenterSport[]
  navigation: {
    topLevelRoute: '/sports-center'
    detailRoutePattern: '/sports-center/[sport]'
    exposedInDashboardShell: true
    canonicalStatusSystem: string[]
  }
  settlementAudit: {
    classification: 'READ_ONLY_ROUTE_AND_DOC_AUDIT'
    finding: string
    mutationApplied: false
    logicChanged: false
  }
}

export type MlbStarterRole = 'STARTER' | 'OPENER' | 'BULK' | 'UNKNOWN'
export type MlbStarterAssignmentStatus = 'CONFIRMED' | 'PROBABLE' | 'EXPECTED' | 'UNDECIDED' | 'SCRATCHED' | 'REPLACED'
export type MlbPitcherMappingStatus =
  | 'EXACT_PROVIDER_ID'
  | 'EXACT_MLB_ID'
  | 'EXACT_CANONICAL_MAPPING'
  | 'EXACT_NAME_TEAM'
  | 'REVIEW_REQUIRED'
  | 'AMBIGUOUS'
  | 'UNMAPPED'

export type MlbStarterAssignment = {
  assignmentId: string
  eventId: string
  teamId: string | null
  opponentTeamId: string | null
  pitcherId: string | null
  providerPitcherId: string | null
  historicalPitcherId: string | null
  pitcherName: string | null
  handedness: string | null
  role: MlbStarterRole
  status: MlbStarterAssignmentStatus
  source: string
  sourceUpdatedAt: string | null
  observedAt: string
  confirmedAt: string | null
  validFrom: string | null
  validUntil: string | null
  confidence: number
  mappingStatus: MlbPitcherMappingStatus
  mappingMethod: string
  warnings: string[]
  blocker: string | null
  homeAway: 'home' | 'away'
  team: string | null
  opponent: string | null
  eventStartTime: string | null
  historicalStarts: number
  recordedOutsStarts: number
  latestHistoricalStart: string | null
}

export type MlbStarterSyncHealth = {
  success: boolean
  mode: string
  generatedAt: string
  selectedDate: string
  providerCallsMade: number
  remoteMutationsMade: number
  starterSlotsEvaluated: number
  starterSlotsWithProviderEvidence: number
  starterSlotsMapped: number
  starterSlotsAmbiguous: number
  starterSlotsUnmapped: number
  duplicateCanonicalMappings: number
  duplicateHistoricalMappings: number
  nameOnlyUnsafeMappings: number
  teamMismatchMappings: number
  inactivePlayerMappings: number
  unexplainedStarterSlots: number
  warnings: string[]
}

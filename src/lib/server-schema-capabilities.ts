import { createClient } from '@supabase/supabase-js'

export type SchemaCapabilityStatus =
  | 'applied'
  | 'missing'
  | 'permission_blocked'
  | 'configuration_missing'
  | 'probe_failed'
  | 'unknown'

export type SchemaCapabilityProbe = {
  table: string
  requiredColumns: string[]
  status: SchemaCapabilityStatus
  applied: boolean
  errorCategory: Exclude<SchemaCapabilityStatus, 'applied'> | null
  warning: string | null
}

export type HistoricalFeatureSchemaCapabilities = {
  mode: 'server_schema_capability_probe_v1'
  generatedAt: string
  providerUsage: {
    externalProviderCallsMade: 0
    source: 'supabase_schema_probe_only'
  }
  environment: {
    serverClient: 'supabase_service_role'
    requiredVariableNames: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    valuesExposed: false
  }
  status: SchemaCapabilityStatus
  applied: boolean
  probes: {
    historicalFeatureSnapshots: SchemaCapabilityProbe
    predictionHistoryFeatureSnapshotLinkage: SchemaCapabilityProbe
    sportPlayerStats: SchemaCapabilityProbe
    sportLineups: SchemaCapabilityProbe
  }
  warnings: string[]
}

export type PredictionVersioningSchemaCapabilities = {
  mode: 'prediction_versioning_schema_capability_probe_v1'
  generatedAt: string
  providerUsage: {
    externalProviderCallsMade: 0
    source: 'supabase_schema_probe_only'
  }
  status: SchemaCapabilityStatus
  applied: boolean
  probes: {
    predictionHistoryVersioning: SchemaCapabilityProbe
  }
  warnings: string[]
}

const REQUIRED_COLUMNS = {
  historicalFeatureSnapshots: [
    'id',
    'deterministic_key',
    'sport_key',
    'event_id',
    'market',
    'prediction_cutoff',
    'as_of_timestamp',
    'feature_values',
    'feature_lineage',
    'source_timestamps',
    'trial',
    'scrambled',
    'production_eligible',
  ],
  predictionHistoryFeatureSnapshotLinkage: [
    'feature_snapshot_id',
    'feature_snapshot_key',
    'feature_set_version',
    'feature_snapshot_generated_at',
  ],
  predictionHistoryVersioning: [
    'is_current',
    'prediction_version',
    'model_role',
    'prediction_group_key',
    'parent_prediction_id',
    'challenger_of_prediction_id',
    'superseded_at',
    'superseded_by_prediction_id',
    'version_created_reason',
    'idempotency_key',
    'version_lineage',
  ],
  sportPlayerStats: [
    'id',
    'sport_key',
    'league_key',
    'season',
    'stat_type',
    'event_id',
    'team_id',
    'player_id',
    'provider',
    'provider_ids',
    'stats',
    'metadata',
  ],
  sportLineups: [
    'id',
    'sport_key',
    'league_key',
    'event_id',
    'team_id',
    'player_id',
    'provider',
    'lineup_type',
    'position',
    'depth_order',
    'starter',
    'provider_ids',
    'metadata',
  ],
} as const

function classifySupabaseSchemaError(error: { code?: string; message?: string; status?: number }) {
  const code = String(error.code ?? '')
  const message = String(error.message ?? '').toLowerCase()
  const status = Number(error.status)

  if (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('could not find the table')
  ) {
    return {
      status: 'missing' as const,
      warning: 'Required table was not visible to the server schema probe.',
    }
  }

  if (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('could not find the') ||
    message.includes('column') ||
    message.includes('schema cache')
  ) {
    return {
      status: 'missing' as const,
      warning: 'Required column was not visible to the server schema probe.',
    }
  }

  if (
    code === '42501' ||
    status === 401 ||
    status === 403 ||
    message.includes('permission denied') ||
    message.includes('not authorized')
  ) {
    return {
      status: 'permission_blocked' as const,
      warning: 'Server Supabase client is not authorized to read the requested schema capability.',
    }
  }

  return {
    status: 'probe_failed' as const,
    warning: 'Schema capability probe failed with a non-classified Supabase error.',
  }
}

async function probeTableColumns({
  table,
  requiredColumns,
}: {
  table: string
  requiredColumns: readonly string[]
}): Promise<SchemaCapabilityProbe> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      table,
      requiredColumns: [...requiredColumns],
      status: 'configuration_missing',
      applied: false,
      errorCategory: 'configuration_missing',
      warning:
        'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server schema probing.',
    }
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { error } = await client
    .from(table)
    .select(requiredColumns.join(','), { count: 'exact', head: true })
    .limit(0)

  if (!error) {
    return {
      table,
      requiredColumns: [...requiredColumns],
      status: 'applied',
      applied: true,
      errorCategory: null,
      warning: null,
    }
  }

  const classified = classifySupabaseSchemaError(error)

  return {
    table,
    requiredColumns: [...requiredColumns],
    status: classified.status,
    applied: false,
    errorCategory: classified.status,
    warning: classified.warning,
  }
}

function aggregateStatus(probes: SchemaCapabilityProbe[]): SchemaCapabilityStatus {
  if (probes.every((probe) => probe.status === 'applied')) return 'applied'
  if (probes.some((probe) => probe.status === 'configuration_missing')) {
    return 'configuration_missing'
  }
  if (probes.some((probe) => probe.status === 'permission_blocked')) {
    return 'permission_blocked'
  }
  if (probes.some((probe) => probe.status === 'probe_failed')) return 'probe_failed'
  if (probes.some((probe) => probe.status === 'missing')) return 'missing'
  return 'unknown'
}

export async function probeHistoricalFeatureSchemaCapabilities(): Promise<HistoricalFeatureSchemaCapabilities> {
  const [
    historicalFeatureSnapshots,
    predictionHistoryFeatureSnapshotLinkage,
    sportPlayerStats,
    sportLineups,
  ] = await Promise.all([
    probeTableColumns({
      table: 'historical_feature_snapshots',
      requiredColumns: REQUIRED_COLUMNS.historicalFeatureSnapshots,
    }),
    probeTableColumns({
      table: 'prediction_history',
      requiredColumns: REQUIRED_COLUMNS.predictionHistoryFeatureSnapshotLinkage,
    }),
    probeTableColumns({
      table: 'sport_player_stats',
      requiredColumns: REQUIRED_COLUMNS.sportPlayerStats,
    }),
    probeTableColumns({
      table: 'sport_lineups',
      requiredColumns: REQUIRED_COLUMNS.sportLineups,
    }),
  ])
  const probes = [
    historicalFeatureSnapshots,
    predictionHistoryFeatureSnapshotLinkage,
    sportPlayerStats,
    sportLineups,
  ]
  const status = aggregateStatus(probes)

  return {
    mode: 'server_schema_capability_probe_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'supabase_schema_probe_only',
    },
    environment: {
      serverClient: 'supabase_service_role',
      requiredVariableNames: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      valuesExposed: false,
    },
    status,
    applied: status === 'applied',
    probes: {
      historicalFeatureSnapshots,
      predictionHistoryFeatureSnapshotLinkage,
      sportPlayerStats,
      sportLineups,
    },
    warnings: probes
      .map((probe) => probe.warning)
      .filter((warning): warning is string => Boolean(warning)),
  }
}

export async function probePredictionVersioningSchemaCapabilities(): Promise<PredictionVersioningSchemaCapabilities> {
  const predictionHistoryVersioning = await probeTableColumns({
    table: 'prediction_history',
    requiredColumns: REQUIRED_COLUMNS.predictionHistoryVersioning,
  })
  const probes = [predictionHistoryVersioning]
  const status = aggregateStatus(probes)

  return {
    mode: 'prediction_versioning_schema_capability_probe_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'supabase_schema_probe_only',
    },
    status,
    applied: status === 'applied',
    probes: {
      predictionHistoryVersioning,
    },
    warnings: probes
      .map((probe) => probe.warning)
      .filter((warning): warning is string => Boolean(warning)),
  }
}

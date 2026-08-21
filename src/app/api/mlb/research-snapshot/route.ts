import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbContextLineage } from '@/services/mlb-context-lineage.service'
import {
  executeMlb04bOneSnapshotPersistence,
  toMlb04bSnapshotRow,
  type Mlb04bSnapshotType,
} from '@/services/mlb-04b-research-snapshot-runtime.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}` || request.nextUrl.searchParams.get('secret') === secret
}

function snapshotType(value: string | null): Mlb04bSnapshotType | null {
  if (value === 'MORNING' || value === 'FINAL_PREGAME') return value
  return null
}

function captureWindow(type: Mlb04bSnapshotType, snapshotTimestamp: string) {
  const date = snapshotTimestamp.slice(0, 10).replaceAll('-', '_')
  if (type === 'MORNING') return `MORNING_${date}`
  return `FINAL_PREGAME_${date}`
}

async function handle(request: NextRequest) {
  const id = requestId(request)
  try {
    const eventId = request.nextUrl.searchParams.get('eventId')
    const type = snapshotType(request.nextUrl.searchParams.get('snapshotType'))
    const execute = request.nextUrl.searchParams.get('execute') === 'true'

    if (!eventId || !type) {
      return apiOk({
        success: false,
        status: 'BLOCKED_ROW_SCOPE',
        mode: 'mlb_04b_one_snapshot_route_v1',
        reason: 'Exactly one eventId and one allowed snapshotType are required.',
        allowedSnapshotTypes: ['MORNING', 'FINAL_PREGAME'],
        providerCallsMade: 0,
        productionDatabaseMutations: 0,
      }, id, { status: 400 })
    }

    if (execute && !authorized(request)) {
      return apiError({ id, code: 'UNAUTHORIZED', message: 'Protected MLB-04B snapshot execution requires CRON_SECRET authorization.', status: 401 })
    }

    const lineage = await getMlbContextLineage({
      eventId,
      snapshotType: type,
      allowProviderCalls: false,
      persist: false,
    })
    const lineageRecord = lineage as Record<string, unknown>
    const snapshots = Array.isArray(lineageRecord.snapshots) ? lineageRecord.snapshots : []
    const scoped = snapshots.map((snapshot) => {
      const row = snapshot as Parameters<typeof toMlb04bSnapshotRow>[0]
      return toMlb04bSnapshotRow({
        ...row,
        snapshot_type: type,
        captureWindow: captureWindow(type, String(row.snapshot_timestamp)),
      })
    })
    const result = await executeMlb04bOneSnapshotPersistence({
      snapshots: scoped,
      execute,
      activationAuthorized: authorized(request),
    })

    return apiOk({
      ...result,
      route: '/api/mlb/research-snapshot',
      sourceLineageMode: lineageRecord.mode,
      sourceLineagePersisted: lineageRecord.persisted,
      sourceLineageProviderCallsMade: lineageRecord.providerCallsMade,
      sourceLineageRemoteMutationsMade: lineageRecord.remoteMutationsMade,
    }, id, { status: result.success ? 200 : 409 })
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB-04B research snapshot error') })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

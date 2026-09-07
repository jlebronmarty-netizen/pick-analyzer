import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { supabaseAdmin } from '@/lib/supabase-admin'

const JOB_TYPE = 'mlb_player_prop_ingestion_v1'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { data, error } = await supabaseAdmin
      .from('sports_sync_jobs')
      .select('id,status,started_at,completed_at,records_fetched,records_inserted,records_skipped,error_count,metadata')
      .eq('job_type', JOB_TYPE)
      .order('started_at', { ascending: false })
      .limit(5)

    if (error) throw new Error(`MLB Decision Board certification ledger read failed: ${error.message}`)

    const entries = (data ?? []).map((row) => {
      const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {}
      return {
        id: row.id,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        recordsFetched: row.records_fetched,
        recordsInserted: row.records_inserted,
        recordsSkipped: row.records_skipped,
        errorCount: row.error_count,
        accounting: {
          projectBudgetKey: metadata.projectBudgetKey ?? null,
          estimatedCredits: metadata.estimatedCredits ?? null,
          observedCredits: metadata.observedCredits ?? null,
          accountedCredits: metadata.accountedCredits ?? null,
          creditAccountingStatus: metadata.creditAccountingStatus ?? null,
          requestsLast: metadata.requestsLast ?? null,
          requestsRemainingBefore: metadata.requestsRemainingBefore ?? null,
          requestsRemainingAfter: metadata.requestsRemainingAfter ?? null,
        },
        acquisition: {
          selectedDate: metadata.selectedDate ?? null,
          markets: metadata.markets ?? null,
          providerCallsMade: metadata.providerCallsMade ?? null,
          recordsFetched: metadata.recordsFetched ?? null,
          recordsPersisted: metadata.recordsPersisted ?? null,
          recordsSkipped: metadata.recordsSkipped ?? null,
        },
      }
    })

    return apiOk({
      success: true,
      mode: 'mlb_decision_board_player_prop_certification_ledger_v1',
      readOnly: true,
      jobType: JOB_TYPE,
      entries,
    }, id)
  } catch (error) {
    return apiError({ id, code: 'INTERNAL_ERROR', message: errorMessage(error, 'Unknown MLB Decision Board certification ledger error') })
  }
}

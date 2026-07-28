import DashboardShell from '@/components/dashboard/DashboardShell'
import { getAutonomousDailyAiPlan } from '@/services/autonomous-daily-ai.service'

export const dynamic = 'force-dynamic'

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value ?? 'N/A'}</p>
    </div>
  )
}

function statusTone(status: string) {
  if (status === 'COMPLETE' || status === 'READY') return 'text-emerald-300'
  if (status === 'DUE_NOW' || status === 'PENDING') return 'text-amber-300'
  if (status === 'BLOCKED') return 'text-red-300'
  return 'text-slate-300'
}

export default async function AutonomousDailyAiPage() {
  const data = await getAutonomousDailyAiPlan()
  const due = data.stages.filter((stage) => stage.status === 'DUE_NOW' || stage.status === 'PENDING')
  const blocked = data.stages.filter((stage) => stage.status === 'BLOCKED')

  return (
    <DashboardShell>
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">Autonomous Daily AI</p>
          <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-4xl font-black text-white">Daily Pipeline Command Layer</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
                Read-only orchestration over existing certified operations. It exposes the daily plan, current blockers, provider budget, action guard and completion state without changing scheduler behavior or executing provider work.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-5 py-4 text-right">
              <p className="text-xs text-slate-500">Completion</p>
              <p className="mt-1 text-2xl font-black text-emerald-300">{data.completionState}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Stat label="Operating Date" value={data.operatingDate} />
          <Stat label="Next Action" value={data.selectedAction} />
          <Stat label="Due Stages" value={due.length} />
          <Stat label="Blocked" value={blocked.length} />
          <Stat label="Provider Calls" value={data.providerCallsMade} />
          <Stat label="Mutations" value={data.remoteMutationsMade} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black text-white">Provider Quota</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Estimated Calls" value={data.providerQuota.estimatedDueNowCalls} />
              <Stat label="Calls Allowed" value={data.providerQuota.callsAllowed} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Stored data sufficient: {data.providerQuota.storedDataSufficient ? 'Yes' : 'No'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black text-white">Dry-Run Safety</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-400">
              <p>Provider calls: {data.dryRunContract.providerCallsMade}</p>
              <p>Remote mutations: {data.dryRunContract.remoteMutationsMade}</p>
              <p>Prediction writes: {data.dryRunContract.writesPredictions ? 'Yes' : 'No'}</p>
              <p>Settlement writes: {data.dryRunContract.settlesPredictions ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-lg font-black text-white">Daily Stages</h2>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {data.stages.map((stage) => (
              <div key={stage.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">{stage.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{stage.idempotencyKey}</p>
                  </div>
                  <p className={`text-xs font-black ${statusTone(stage.status)}`}>{stage.status}</p>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-slate-400">
                  <p>Rows {stage.rowsExamined}</p>
                  <p>Changed {stage.rowsChanged}</p>
                  <p>Calls {stage.providerCalls}</p>
                  <p>Writes {stage.remoteMutations}</p>
                </div>
                {stage.blockers.length ? <p className="mt-3 text-xs leading-5 text-amber-300">{stage.blockers.join(' ')}</p> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}

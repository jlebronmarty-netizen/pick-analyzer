import DashboardShell from '@/components/dashboard/DashboardShell'
import { getClosingLineIntelligence } from '@/services/closing-line-intelligence.service'

export const dynamic = 'force-dynamic'

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value ?? 'N/A'}</p>
    </div>
  )
}

function odds(value: number | null) {
  if (value === null) return 'N/A'
  return value > 0 ? `+${value}` : `${value}`
}

export default async function ClosingLineIntelligencePage() {
  const data = await getClosingLineIntelligence({ sportKey: 'all', limit: 500 })
  const records = data.records.slice(0, 12)

  return (
    <DashboardShell>
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-300">Closing Line Intelligence</p>
          <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-4xl font-black text-white">Closing Evidence Foundation</h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
                Latest valid aligned pre-start stored prices are compared with stored prediction-time prices only when event, market, selection and bookmaker scope match. No post-start price, estimated close or provider reconstruction is used.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-5 py-4 text-right">
              <p className="text-xs text-slate-500">Status</p>
              <p className="mt-1 text-2xl font-black text-emerald-300">{data.readiness.status}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Stat label="Settled Predictions" value={data.readiness.eligibleSettledPredictions} />
          <Stat label="Prediction Prices" value={data.readiness.predictionTimePriceCoverage} />
          <Stat label="Closing Candidates" value={data.readiness.closingPriceCoverage} />
          <Stat label="Aligned Pairs" value={data.readiness.alignedPairCoverage} />
          <Stat label="Provider Calls" value={data.providerCallsMade} />
          <Stat label="Remote Mutations" value={data.remoteMutationsMade} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black text-white">Method</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{data.method.closingCandidate}</p>
            <div className="mt-4 space-y-2 text-sm text-slate-500">
              {data.method.assumptions.map((assumption) => (
                <p key={assumption}>{assumption}</p>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black text-white">CLV Distribution</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Samples" value={data.clvDistribution.samples} />
              <Stat label="Positive" value={data.clvDistribution.positive} />
              <Stat label="Negative" value={data.clvDistribution.negative} />
              <Stat label="Neutral" value={data.clvDistribution.neutral} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-lg font-black text-white">Missing Evidence</h2>
          {data.blockerSummary.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No blockers were found in the returned sample.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {data.blockerSummary.slice(0, 8).map((item) => (
                <div key={item.blocker} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xl font-black text-white">{item.count}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{item.blocker}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-lg font-black text-white">Detail</h2>
          {records.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No production-evaluable settled predictions are available in this scope.</p>
          ) : (
            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              {records.map((record) => (
                <div key={record.predictionId} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{record.selection}</p>
                      <p className="mt-1 text-xs text-slate-500">{record.eventLabel}</p>
                    </div>
                    <p className="text-xs font-black text-teal-300">{record.availability}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <p className="text-slate-400">Prediction {odds(record.predictionTimePrice)}</p>
                    <p className="text-slate-400">Close {odds(record.closingCandidatePrice)}</p>
                    <p className="text-slate-400">{record.clv.closingAdvantageStatus}</p>
                  </div>
                  {record.blocker ? <p className="mt-3 text-xs leading-5 text-slate-500">{record.blocker}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  )
}

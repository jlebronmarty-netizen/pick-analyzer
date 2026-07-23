import DashboardSection from '@/components/dashboard/DashboardSection'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { getAiLearningLifecycle } from '@/services/ai-learning-lifecycle.service'

function statusTone(status: string) {
  if (status === 'Healthy' || status === 'Completed') return 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
  if (status === 'Running') return 'border-sky-500/30 bg-sky-950/20 text-sky-200'
  if (status === 'Blocked' || status === 'Error') return 'border-rose-500/30 bg-rose-950/20 text-rose-200'
  return 'border-amber-500/30 bg-amber-950/20 text-amber-200'
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value === null || value === undefined || value === '' ? 'N/A' : String(value)}</p>
    </div>
  )
}

function PanelCard({ panel }: { panel: any }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-white">{panel.label}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{panel.summary}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${statusTone(panel.status)}`}>
          {panel.status}
        </span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        {Object.entries(panel.metrics ?? {}).slice(0, 6).map(([key, value]) => (
          <div key={key} className="rounded-lg bg-slate-950/70 p-3">
            <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</dt>
            <dd className="mt-1 font-bold text-slate-100">{value === null || value === undefined || value === '' ? 'N/A' : String(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 space-y-1 text-xs text-slate-500">
        <p>Last: {panel.lastUpdated || 'N/A'}</p>
        <p>Next: {panel.nextRun || 'Waiting for next scheduler execution'}</p>
        {panel.blocker ? <p className="text-amber-300">Reason: {panel.blocker}</p> : null}
      </div>
    </article>
  )
}

export const dynamic = 'force-dynamic'

export default async function AiOperationsPage() {
  const data = await getAiLearningLifecycle()

  return (
    <DashboardShell>
      <DashboardSection
        id="ai-operations"
        eyebrow="AI Operations"
        title="Autonomous Daily Lifecycle"
        description="Persisted evidence for schedule, odds, predictions, settlement, replay, learning, calibration and scheduler health."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Provider Calls" value={data.providerCallsMade} />
          <Metric label="Today Predictions" value={data.lifecycle.today.predictionsGenerated} />
          <Metric label="Today Settled" value={data.lifecycle.today.productionSettled} />
          <Metric label="Learning Queued" value={data.learningQueue.queued} />
        </div>
      </DashboardSection>

      <DashboardSection
        id="daily-story"
        eyebrow="Daily AI Story"
        title="What The System Did"
        description="No learning is claimed unless persisted deterministic evidence exists."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {(['today', 'yesterday', 'last7Days'] as const).map((key) => (
            <article key={key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">{key}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{data.dailyAiStory[key]}</p>
            </article>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        id="operations-v2"
        eyebrow="AI Operations V2"
        title="Daily Evidence Stages"
        description="Daily settlement, label, shadow learning and weight evidence with explicit zero reasons."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {Object.entries(data.aiOperationsCenterV2).map(([period, stage]: [string, any]) => (
            <article key={period} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">{period}</h3>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusTone(stage.acceptedLearningSamples > 0 ? 'Completed' : 'Waiting')}`}>
                  {stage.shadowLearning}
                </span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Games', stage.games],
                  ['Odds', stage.odds ?? 'N/A'],
                  ['Predictions', stage.predictions],
                  ['Settlements', stage.settlements],
                  ['Labels', stage.labels],
                  ['Accepted', stage.acceptedLearningSamples],
                  ['Rejected', stage.rejectedSamples],
                  ['Weights', stage.weightUpdates],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-950/70 p-3">
                    <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</dt>
                    <dd className="mt-1 font-bold text-slate-100">{String(value)}</dd>
                  </div>
                ))}
              </dl>
              {stage.zeroReasons ? (
                <div className="mt-4 space-y-1 text-xs text-amber-200">
                  {Object.entries(stage.zeroReasons).filter(([, value]) => Boolean(value)).map(([key, value]) => (
                    <p key={key}>{key}: {String(value)}</p>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        id="local-backfill"
        eyebrow="Historical Features"
        title="Local Backfill Status"
        description="Read-only status for the operator-controlled Retrosheet feature backfill worker."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Snapshots Persisted" value={data.historicalFeatureBackfill.snapshotsPersisted} />
          <Metric label="Games Covered" value={data.historicalFeatureBackfill.gamesCovered} />
          <Metric label="Coverage" value={`${data.historicalFeatureBackfill.coveragePct}%`} />
          <Metric label="Feature Label Coverage" value={`${data.historicalFeatureBackfill.featureLabelCoveragePct ?? 0}%`} />
          <Metric label="Checkpoints" value={data.historicalFeatureBackfill.checkpointsRead} />
          <Metric label="Missing Feature Labels" value={data.historicalFeatureBackfill.missingFeatureRejections} />
          <Metric label="Idempotency" value={data.historicalFeatureBackfill.idempotencyStatus ?? 'N/A'} />
          <Metric label="Shadow Readiness" value={data.historicalFeatureBackfill.shadowReadiness} />
        </div>
      </DashboardSection>

      <DashboardSection
        id="panels"
        eyebrow="Operations Center"
        title="Pipeline Health"
        description="Each panel is backed by stored database evidence and uses only read-only diagnostics."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {data.panels.map((panel: any) => (
            <PanelCard key={panel.key} panel={panel} />
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        id="transitions"
        eyebrow="Lifecycle Trace"
        title="Stage Transitions"
        description="The AI learning chain is shown as evidence, blocker and current state for every transition."
      >
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full min-w-[760px] border-collapse bg-slate-900/70 text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Evidence</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.pipelineTransitions.map((transition: any) => (
                <tr key={`${transition.from}-${transition.to}`} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-slate-200">{transition.from}</td>
                  <td className="px-4 py-3 text-slate-200">{transition.to}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusTone(transition.status)}`}>
                      {transition.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-white">{transition.evidence}</td>
                  <td className="px-4 py-3 text-slate-400">{transition.blocker || 'OK'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection
        id="queues"
        eyebrow="Learning Evidence"
        title="Labels, Replay And Weights"
        description="The queue is derived from settled rows and is not a Learning Brain write."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Metric label="Deterministic Labels" value={data.trainingLabels.totalDeterministicProductionLabels} />
          <Metric label="Replay Rows" value={data.historicalReplayValidation.projectionRows} />
          <Metric label="Weight Updates" value={data.weightUpdates.count} />
          <Metric label="Queued" value={data.learningQueue.queued} />
          <Metric label="Accepted" value={data.learningQueue.accepted} />
          <Metric label="Rejected" value={data.learningQueue.rejected} />
        </div>
      </DashboardSection>

      <DashboardSection
        id="refresh"
        eyebrow="Refresh Timeline"
        title="Last And Next Runs"
        description="Missing next-run evidence is explicitly labeled instead of invented."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(data.refreshTimeline).map(([key, value]: [string, any]) => (
            <article key={key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">{key}</h3>
              <p className="mt-3 text-sm text-slate-500">Last successful refresh</p>
              <p className="mt-1 font-bold text-white">{value.lastSuccessfulRefresh || 'N/A'}</p>
              <p className="mt-4 text-sm text-slate-500">Next scheduled refresh</p>
              <p className="mt-1 font-bold text-emerald-200">{value.nextScheduledRefresh || 'Waiting for next scheduler execution'}</p>
            </article>
          ))}
        </div>
      </DashboardSection>
    </DashboardShell>
  )
}

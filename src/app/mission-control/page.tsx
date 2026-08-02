import type { Metadata } from 'next'

import { getMissionControl } from '@/services/mission-control.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Mission Control | Pick Analyzer',
  description: 'Read-only Pick Analyzer V2 mission queue and operational readiness command center.',
}

type MissionControlData = Awaited<ReturnType<typeof getMissionControl>>
type Tone = 'ready' | 'partial' | 'blocked' | 'waiting' | 'degraded'

const toneStyles: Record<Tone, string> = {
  ready: 'border-emerald-400/40 bg-emerald-950/30 text-emerald-100',
  partial: 'border-amber-400/40 bg-amber-950/30 text-amber-100',
  blocked: 'border-rose-400/40 bg-rose-950/30 text-rose-100',
  waiting: 'border-sky-400/40 bg-sky-950/30 text-sky-100',
  degraded: 'border-zinc-400/40 bg-zinc-900/50 text-zinc-100',
}

const barStyles: Record<Tone, string> = {
  ready: 'bg-emerald-400',
  partial: 'bg-amber-400',
  blocked: 'bg-rose-400',
  waiting: 'bg-sky-400',
  degraded: 'bg-zinc-400',
}

function fmt(value: unknown, fallback = 'n/a') {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function toneFrom(value: unknown): Tone {
  const normalized = String(value ?? '').toLowerCase()
  if (['complete', 'certified', 'ready', 'deployed', 'pass'].some((term) => normalized.includes(term))) return 'ready'
  if (['blocked', 'fail', 'not_ready'].some((term) => normalized.includes(term))) return 'blocked'
  if (['planned', 'wait', 'paused', 'unknown'].some((term) => normalized.includes(term))) return 'waiting'
  if (['conditional', 'partial', 'limited'].some((term) => normalized.includes(term))) return 'partial'
  return 'degraded'
}

function scoreFor(value: unknown) {
  return {
    ready: 92,
    partial: 62,
    waiting: 38,
    degraded: 28,
    blocked: 12,
  }[toneFrom(value)]
}

function Pill({ value, tone }: { value: unknown; tone?: Tone }) {
  const resolved = tone ?? toneFrom(value)
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-bold ${toneStyles[resolved]}`}>
      <span className={`h-2 w-2 rounded-full ${barStyles[resolved]}`} />
      {fmt(value)}
    </span>
  )
}

function Progress({ value }: { value: unknown }) {
  const score = scoreFor(value)
  const tone = toneFrom(value)
  return (
    <div className="mt-3 h-2 rounded-full bg-zinc-800">
      <div className={`h-2 rounded-full ${barStyles[tone]}`} style={{ width: `${score}%` }} />
    </div>
  )
}

function Panel({ title, status, children }: { title: string; status?: unknown; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 shadow-xl shadow-black/20">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-white">{title}</h2>
        {status !== undefined ? <Pill value={status} /> : null}
      </div>
      {children}
    </section>
  )
}

function Hero({ data }: { data: MissionControlData }) {
  return (
    <section className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill value={data.currentMission.state} />
            <Pill value={data.autonomousReadiness.status} />
            <Pill value="READ ONLY" tone="waiting" />
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-normal text-white md:text-5xl">
            Pick Analyzer Mission Control
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">
            Current V2 execution state, next eligible work, sport readiness and operational stop conditions from stored
            repository and runtime evidence.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-xs font-bold text-zinc-500">Runtime Commit</p>
              <p className="mt-2 break-all text-sm font-semibold text-zinc-100">{data.program.runtimeCommit}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-xs font-bold text-zinc-500">Current Mission</p>
              <p className="mt-2 text-sm font-semibold text-zinc-100">{data.currentMission.id}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-xs font-bold text-zinc-500">Generated</p>
              <p className="mt-2 text-sm font-semibold text-zinc-100">{data.generatedAt}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs font-bold uppercase text-zinc-500">Next Eligible Mission</p>
          {data.nextMission ? (
            <>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-white">{data.nextMission.id}</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-200">{data.nextMission.title}</p>
                </div>
                <Pill value={data.nextMission.priority} />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{data.nextMission.nextAction}</p>
              <Progress value={data.nextMission.readiness} />
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">No next mission is currently eligible.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function Health({ data }: { data: MissionControlData }) {
  return (
    <Panel title="Project Health" status={data.autonomousReadiness.status}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.projectHealth.map((item) => (
          <div key={item.domain} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-white">{item.domain}</p>
              <Pill value={item.status} />
            </div>
            <Progress value={item.status} />
            <p className="mt-3 text-xs leading-5 text-zinc-400">{item.summary}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function Queue({ data }: { data: MissionControlData }) {
  return (
    <Panel title="Mission Queue" status={`${data.queue.length} missions`}>
      <div className="grid gap-3">
        {data.queue.map((mission) => (
          <article key={mission.id} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill value={mission.id} tone="degraded" />
              <Pill value={mission.state} />
              <Pill value={mission.priority} />
              <Pill value={mission.mode} />
            </div>
            <h3 className="mt-3 text-base font-black text-white">{mission.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{mission.scope}</p>
            <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-xs font-bold text-zinc-500">Next Action</p>
              <p className="mt-2 text-sm leading-5 text-zinc-300">{mission.nextAction}</p>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  )
}

function SportMatrix({ data }: { data: MissionControlData }) {
  return (
    <Panel title="Sport Readiness" status="matrix">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.sportReadiness.map((sport) => (
          <div key={sport.sport} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-black text-white">{sport.sport}</p>
                <p className="mt-1 text-xs text-zinc-500">{sport.maturity}</p>
              </div>
              <Pill value={sport.readiness} />
            </div>
            <Progress value={sport.readiness} />
            <p className="mt-3 text-xs leading-5 text-zinc-400">{sport.currentStage}</p>
            <p className="mt-3 text-xs font-semibold text-zinc-300">{sport.nextStage}</p>
            {sport.blockers.length ? <p className="mt-3 text-xs leading-5 text-amber-200">{sport.blockers[0]}</p> : null}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function Providers({ data }: { data: MissionControlData }) {
  return (
    <Panel title="Provider Readiness" status="guarded">
      <div className="grid gap-3 lg:grid-cols-3">
        {data.providerReadiness.map((provider) => (
          <div key={`${provider.provider}:${provider.sportKey}`} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">{provider.provider}</p>
                <p className="mt-1 text-xs text-zinc-500">{provider.sportKey}</p>
              </div>
              <Pill value={provider.readiness} />
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-400">{provider.activeScope}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-2">
                <p className="text-xs text-zinc-500">Calls</p>
                <p className="text-sm font-black text-white">{provider.providerCallsMadeByMissionControl}</p>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-2">
                <p className="text-xs text-zinc-500">Mutations</p>
                <p className="text-sm font-black text-white">{provider.remoteMutationsMadeByMissionControl}</p>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-2">
                <p className="text-xs text-zinc-500">Reserve</p>
                <p className="text-sm font-black text-white">{fmt(provider.reserveProtected)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function StopConditions({ data }: { data: MissionControlData }) {
  return (
    <Panel title="Stop Conditions" status={`${data.stopConditions.length} rules`}>
      <div className="grid gap-3 md:grid-cols-2">
        {data.stopConditions.map((condition) => (
          <div key={condition.id} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill value={condition.id} tone="degraded" />
              <Pill value={condition.type} />
            </div>
            <p className="mt-3 text-sm font-bold text-white">{condition.title}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">{condition.action}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export default async function MissionControlPage() {
  const data = await getMissionControl()
  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <Hero data={data} />
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6">
        <Health data={data} />
        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <Queue data={data} />
          <div className="grid gap-5">
            <Providers data={data} />
            <Panel title="Recent Completions" status="OE-003A-F">
              <div className="grid gap-2">
                {data.recentCompletions.map((mission) => (
                  <div key={mission.id} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-white">{mission.id}</p>
                      <Pill value={mission.state} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">{mission.title}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
        <SportMatrix data={data} />
        <StopConditions data={data} />
        <Panel title="Developer Links" status="read only">
          <div className="grid gap-2 md:grid-cols-3">
            {data.evidence.runtimeEndpoints.map((endpoint) => (
              <a
                key={endpoint}
                className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-sm font-semibold text-zinc-200 hover:border-zinc-600"
                href={endpoint}
              >
                {endpoint}
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </main>
  )
}

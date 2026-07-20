'use client'

import { useEffect, useMemo, useState } from 'react'

type EndpointRow = {
  id: string
  endpoint: string
  domain: string
  providerVariant: string
  status: string
  pilotEvidence: string
  fieldProfileCount: number
  recommendation: string
}

type CapabilityRow = {
  capability: string
  status: string
  evidence: string
  projectionUse: string
}

type DiscoveryResponse = {
  success: boolean
  generatedAt: string
  date: string
  providerCallsMade: number
  remoteMutationsMade: number
  summary: {
    endpointsCataloged: number
    discoveryLabEndpoints: number
    enterpriseEndpoints: number
    statusCounts: Record<string, number>
    latestSyncJobsInspected: number
  }
  fieldQuality: {
    fieldsProfiled: number
    source: string
    scrambledDataPolicy: string
  }
  identityMapping: {
    providerMappingRows: number
    status: string
  }
  projectionReactivation: {
    currentSafeState: string
    batterProjections: string
    pitcherProjections: string
    reactivationAllowedNow: boolean
  }
  endpoints: EndpointRow[]
  capabilityMatrix: CapabilityRow[]
  warnings: string[]
  validation?: {
    success: boolean
    passed: number
    failed: number
  }
  error?: { message?: string } | string
}

function statusClass(status: string) {
  if (status === 'ACCESSIBLE' || status === 'AVAILABLE') return 'text-emerald-300'
  if (status.includes('PARTIAL') || status.includes('LIMITED') || status.includes('READY')) return 'text-sky-300'
  if (status.includes('EMPTY') || status.includes('CATALOG') || status.includes('UNTESTED')) return 'text-amber-300'
  if (status.includes('BLOCKED') || status.includes('UNSUPPORTED')) return 'text-red-300'
  return 'text-slate-300'
}

function errorText(error: unknown) {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? 'Unknown error')
  return 'Unable to load SportsDataIO discovery'
}

export default function SportsDataIoDiscoveryLabPanel() {
  const [data, setData] = useState<DiscoveryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/providers/sportsdataio/discovery?includeValidation=true', { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok || !json.success) throw new Error(errorText(json.error))
      setData(json)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load SportsDataIO discovery')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const endpointPreview = useMemo(() => (data?.endpoints ?? []).slice(0, 12), [data?.endpoints])

  if (loading && !data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading SportsDataIO Discovery...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">SportsDataIO</p>
          <h2 className="mt-2 text-3xl font-black text-white">Discovery Lab</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            MLB endpoint inventory, stored-evidence field quality and projection activation guard. This panel performs no provider calls.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className="text-sm font-black uppercase text-emerald-300">
            {data?.providerCallsMade ?? 0} provider calls
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-900/40"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Endpoints" value={data?.summary.endpointsCataloged ?? 0} />
        <Stat label="Discovery Lab" value={data?.summary.discoveryLabEndpoints ?? 0} />
        <Stat label="Enterprise" value={data?.summary.enterpriseEndpoints ?? 0} />
        <Stat label="Fields Profiled" value={data?.fieldQuality.fieldsProfiled ?? 0} />
        <Stat label="Mappings" value={data?.identityMapping.providerMappingRows ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Status Buckets</p>
          <div className="mt-4 grid gap-3">
            {Object.entries(data?.summary.statusCounts ?? {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                <p className={`text-xs font-black uppercase ${statusClass(status)}`}>{status}</p>
                <p className="text-lg font-black text-white">{count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Projection Guard</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Guard label="Reactivation" value={data?.projectionReactivation.reactivationAllowedNow ? 'Allowed' : 'Blocked'} />
            <Guard label="Batters" value={data?.projectionReactivation.batterProjections ?? 'unknown'} />
            <Guard label="Pitchers" value={data?.projectionReactivation.pitcherProjections ?? 'unknown'} />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            {data?.projectionReactivation.currentSafeState}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-black text-white">Capability Matrix</p>
        <div className="mt-4 grid gap-3">
          {(data?.capabilityMatrix ?? []).map((row) => (
            <div key={row.capability} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <p className="font-black text-white">{row.capability}</p>
                <p className={`text-xs font-black uppercase ${statusClass(row.status)}`}>{row.status}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{row.evidence}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{row.projectionUse}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-black text-white">Endpoint Preview</p>
        <div className="mt-4 grid gap-3">
          {endpointPreview.map((endpoint) => (
            <div key={endpoint.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="break-all font-mono text-xs text-slate-300">{endpoint.endpoint}</p>
                  <p className="mt-1 text-xs text-slate-500">{endpoint.domain} · {endpoint.providerVariant} · fields {endpoint.fieldProfileCount}</p>
                </div>
                <p className={`text-xs font-black uppercase ${statusClass(endpoint.status)}`}>{endpoint.status}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{endpoint.pilotEvidence}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Field Quality</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{data?.fieldQuality.source}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{data?.fieldQuality.scrambledDataPolicy}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Validation</p>
          <p className={`mt-3 text-2xl font-black ${data?.validation?.success ? 'text-emerald-300' : 'text-red-300'}`}>
            {data?.validation?.success ? 'Passed' : 'Unavailable'}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Passed {data?.validation?.passed ?? 0}, failed {data?.validation?.failed ?? 0}. Remote mutations: {data?.remoteMutationsMade ?? 0}.
          </p>
        </div>
      </div>

      {(data?.warnings ?? []).length ? (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
          <p className="text-sm font-black text-amber-200">Warnings</p>
          <div className="mt-3 grid gap-2">
            {(data?.warnings ?? []).map((warning) => (
              <p key={warning} className="text-sm leading-6 text-amber-100">{warning}</p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function Guard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
    </div>
  )
}

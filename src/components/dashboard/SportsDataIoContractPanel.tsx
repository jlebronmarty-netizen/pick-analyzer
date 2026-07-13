'use client'

import { useEffect, useState } from 'react'

type SportsDataIoResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  activation: {
    liveCallsEnabled: boolean
    credentialsRequiredNow: boolean
    requiredBeforeActivation: string[]
  }
  summary: {
    endpoints: number
    capabilities: number
    sportCoverage: number
    contractReadySports: number
    partialSports: number
    unsupportedSports: number
    validationErrors: number
    validationWarnings: number
  }
  coverage: Array<{
    sportKey: string
    leagueKey: string
    status: string
    supportedDataTypes: string[]
    warnings: string[]
  }>
  error?: string
}

function statusClass(status: string) {
  if (status === 'contract_ready') return 'text-emerald-300'
  if (status === 'partial_contract') return 'text-amber-300'
  return 'text-red-300'
}

export default function SportsDataIoContractPanel() {
  const [data, setData] = useState<SportsDataIoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/providers/sportsdataio/contract', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Unable to load SportsDataIO contract')
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load SportsDataIO contract'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading SportsDataIO Contract...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
            SportsDataIO
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Adapter Contract
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Maps future SportsDataIO payload concepts into normalized project
            models. Live calls, credentials and imports remain disabled.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'unsupported')}`}>
            {data?.status ?? 'unsupported'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-4 py-2 text-sm font-bold text-indigo-100 hover:bg-indigo-900/40"
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
        <Stat label="Endpoints" value={data?.summary.endpoints ?? 0} />
        <Stat label="Contract Sports" value={data?.summary.contractReadySports ?? 0} />
        <Stat label="Partial Sports" value={data?.summary.partialSports ?? 0} />
        <Stat label="Validation Errors" value={data?.summary.validationErrors ?? 0} />
        <Stat
          label="Provider Calls"
          value={data?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Coverage Contract</p>
          <div className="mt-4 grid gap-3">
            {(data?.coverage ?? []).map((coverage) => (
              <div
                key={`${coverage.sportKey}:${coverage.leagueKey}`}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-black text-white">
                      {coverage.sportKey}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {coverage.supportedDataTypes.length
                        ? coverage.supportedDataTypes.join(', ')
                        : 'No contract coverage'}
                    </p>
                  </div>
                  <p className={`text-xs font-black uppercase ${statusClass(coverage.status)}`}>
                    {coverage.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Activation Guard</p>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Live Calls
            </p>
            <p className="mt-2 text-2xl font-black text-white">
              {data?.activation.liveCallsEnabled ? 'Enabled' : 'Disabled'}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Credentials required now:{' '}
              {data?.activation.credentialsRequiredNow ? 'yes' : 'no'}
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            {(data?.activation.requiredBeforeActivation ?? []).map((item) => (
              <p
                key={item}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-6 text-slate-300"
              >
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

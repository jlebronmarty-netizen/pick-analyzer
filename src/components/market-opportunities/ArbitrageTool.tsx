'use client'

import { useEffect, useState } from 'react'

type Stake = {
  outcome: string
  sportsbook: string
  odds: number
  line: number | null
  stake: number
  payout: number
  oddsAgeMinutes: number
}

type Opportunity = {
  id: string
  status: string
  matchup: string
  market: string
  guaranteedReturn: number
  investment: number
  expectedProfit: number
  margin: number
  oddsAgeMinutes: number
  executionRisk: string
  stakes: Stake[]
}

type Response = {
  success: boolean
  summary: {
    status: string
    guaranteedCount: number
    potentialCount: number
    verifiedSportsbooks: string[]
    checkedGroups: number
    warning: string
  }
  opportunities: Opportunity[]
  notificationSettings: {
    architectureOnly: boolean
    guaranteedArbitrage: boolean
    minimumMarginPercent: number
    minimumProfit: number
    maximumStake: number
    preferredSportsbooks: string[]
    maximumOddsAgeMinutes: number
    browserNotificationEnabled: boolean
    emailPlaceholder: string
    futureMobilePlaceholder: string
  }
}

function money(value: number) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function odds(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

function statusText(value: string) {
  if (value === 'ARBITRAGE_FOUND') return 'Arbitrage found'
  if (value === 'NO_ARBITRAGE_FOUND') return 'No arbitrage found'
  if (value === 'MULTIBOOK_DATA_UNAVAILABLE') return 'Multi-book data unavailable'
  if (value === 'SCANNER_DATA_ERROR') return 'Data temporarily unavailable'
  return 'Unsupported'
}

export default function ArbitrageTool() {
  const [investment, setInvestment] = useState(1000)
  const [staleMinutes, setStaleMinutes] = useState(120)
  const [data, setData] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setError(null)
        const response = await fetch(
          `/api/market-opportunities/arbitrage?investment=${investment}&staleMinutes=${staleMinutes}`,
          { cache: 'no-store' }
        )
        const json = await response.json()
        if (!response.ok || !json.success) throw new Error(json.error?.message ?? 'Unable to load arbitrage scanner')
        setData(json)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load arbitrage scanner')
      }
    }
    load()
  }, [investment, staleMinutes])

  return (
    <main className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        <header className="flex min-w-0 flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <a href="/dashboard" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">
              Back to Dashboard
            </a>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
              Optional Tool
            </p>
            <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">Arbitrage</h1>
            <p className="mt-3 max-w-[18rem] break-words text-sm leading-6 text-slate-400 sm:max-w-3xl">
              Stored-odds scanner for mathematically covered markets. It never claims guaranteed arbitrage unless every outcome is covered by fresh, matching rules.
            </p>
          </div>
          <div className="grid w-full max-w-full gap-3 sm:grid-cols-2 lg:w-auto">
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Investment
              <input
                value={investment}
                onChange={(event) => setInvestment(Number(event.target.value))}
                type="number"
                min={10}
                max={100000}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Max Odds Age
              <select
                value={staleMinutes}
                onChange={(event) => setStaleMinutes(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
              >
                <option value={15}>15 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={120}>2 hours</option>
                <option value={1440}>24 hours</option>
              </select>
            </label>
          </div>
        </header>

        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-red-200">Data temporarily unavailable. Arbitrage scan did not complete.</div> : null}

        <section className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Status" value={statusText(data?.summary.status ?? 'MULTIBOOK_DATA_UNAVAILABLE')} />
          <Summary label="Guaranteed" value={data?.summary.guaranteedCount ?? 0} />
          <Summary label="Potential" value={data?.summary.potentialCount ?? 0} />
          <Summary label="Provider Calls" value="0" />
        </section>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 text-sm leading-6 text-amber-100">
          {data?.summary.warning ?? 'Potential arbitrage may disappear before wagers are placed.'}
        </div>

        <section className="grid gap-4">
          {(data?.opportunities ?? []).length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <p className="text-2xl font-black">No guaranteed arbitrage found.</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                {data?.summary.status === 'SCANNER_DATA_ERROR'
                  ? 'The scan did not complete, so this page is not claiming there is no arbitrage.'
                  : data?.summary.status === 'MULTIBOOK_DATA_UNAVAILABLE'
                    ? 'Verified multi-book pricing is unavailable. Consensus-only prices cannot prove arbitrage.'
                    : 'The scanner will stay conservative. If stored data cannot prove sportsbook separation, matching market rules, fresh odds and all outcomes covered, it will not call the opportunity guaranteed.'}
              </p>
              <details className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <summary className="cursor-pointer text-sm font-black">Advanced Details</summary>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Metric label="Scanner State" value={data?.summary.status ?? 'MULTIBOOK_DATA_UNAVAILABLE'} />
                  <Metric label="Checked Groups" value={String(data?.summary.checkedGroups ?? 0)} />
                  <Metric label="Verified Books" value={data?.summary.verifiedSportsbooks.join(', ') || 'none'} />
                </div>
              </details>
            </div>
          ) : (
            data?.opportunities.map((item) => (
              <article key={item.id} className="min-w-0 rounded-3xl border border-emerald-500/30 bg-emerald-950/10 p-5">
                <div className="grid min-w-0 gap-5 lg:grid-cols-3">
                  <div className="min-w-0">
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-950/30 px-3 py-1 text-xs font-black text-emerald-200">
                      Guaranteed Arbitrage
                    </span>
                    <h2 className="mt-3 break-words text-2xl font-black">{item.matchup}</h2>
                    <p className="mt-1 break-words text-sm text-slate-400">{item.market}</p>
                    <p className="mt-3 break-words text-sm text-slate-300">{item.executionRisk}</p>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <Metric label="Investment" value={money(item.investment)} />
                    <Metric label="Return" value={money(item.guaranteedReturn)} />
                    <Metric label="Profit" value={money(item.expectedProfit)} tone="good" />
                    <Metric label="Margin" value={`${item.margin.toFixed(2)}%`} tone="good" />
                  </div>
                  <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Stake Plan</p>
                    <div className="mt-3 space-y-2">
                      {item.stakes.map((stake) => (
                        <div key={`${stake.outcome}-${stake.sportsbook}`} className="rounded-xl bg-slate-900/70 p-3 text-sm">
                          <p className="font-bold">{stake.outcome} | {stake.sportsbook} {odds(stake.odds)}</p>
                          <p className="mt-1 text-slate-400">Stake {money(stake.stake)} to return {money(stake.payout)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Notification Settings</p>
          <h2 className="mt-2 text-2xl font-black">Alerts Architecture</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Coming later - requires verified multi-book data and notification infrastructure.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Setting label="Guaranteed arbitrage found" value="On" />
            <Setting label="Minimum margin" value={`${data?.notificationSettings.minimumMarginPercent ?? 1}%`} />
            <Setting label="Minimum profit" value={money(data?.notificationSettings.minimumProfit ?? 25)} />
            <Setting label="Maximum stake" value={money(investment)} />
            <Setting label="Preferred sportsbooks" value={data?.summary.verifiedSportsbooks.join(', ') || 'Not verified'} />
            <Setting label="Odds age" value={`${staleMinutes} minutes`} />
            <Setting label="Browser notification" value="Disabled - backend not enabled" />
            <Setting label="Email" value="Disabled - backend not enabled" />
            <Setting label="Mobile" value="Disabled - future capability" />
          </div>
        </section>
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="break-words text-xs font-bold uppercase tracking-[0.08em] text-slate-500 sm:tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'neutral' }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-950/70 p-3">
      <p className="break-words text-xs text-slate-500">{label}</p>
      <p className={`mt-1 break-words font-black ${tone === 'good' ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 break-words font-bold text-white">{value}</p>
    </div>
  )
}

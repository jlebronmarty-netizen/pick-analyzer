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
  if (value === 'GUARANTEED_ARBITRAGE_FOUND') return 'Guaranteed arbitrage found'
  if (value === 'POTENTIAL_ARBITRAGE_ONLY') return 'Potential arbitrage only'
  if (value === 'ARBITRAGE_UNAVAILABLE') return 'Arbitrage unavailable'
  return 'No arbitrage right now'
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
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a href="/dashboard" className="text-sm font-bold text-emerald-300 hover:text-emerald-200">
              Back to Dashboard
            </a>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
              Optional Tool
            </p>
            <h1 className="mt-2 text-4xl font-black">Arbitrage</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Stored-odds scanner for mathematically covered markets. It never claims guaranteed arbitrage unless every outcome is covered by fresh, matching rules.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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

        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-red-200">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <Summary label="Status" value={statusText(data?.summary.status ?? 'NO_ARBITRAGE')} />
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
                The scanner will stay conservative. If stored data cannot prove sportsbook separation, matching market rules, fresh odds and all outcomes covered, it will not call the opportunity guaranteed.
              </p>
            </div>
          ) : (
            data?.opportunities.map((item) => (
              <article key={item.id} className="rounded-3xl border border-emerald-500/30 bg-emerald-950/10 p-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
                  <div>
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-950/30 px-3 py-1 text-xs font-black text-emerald-200">
                      Guaranteed Arbitrage
                    </span>
                    <h2 className="mt-3 text-2xl font-black">{item.matchup}</h2>
                    <p className="mt-1 text-sm text-slate-400">{item.market}</p>
                    <p className="mt-3 text-sm text-slate-300">{item.executionRisk}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="Investment" value={money(item.investment)} />
                    <Metric label="Return" value={money(item.guaranteedReturn)} />
                    <Metric label="Profit" value={money(item.expectedProfit)} tone="good" />
                    <Metric label="Margin" value={`${item.margin.toFixed(2)}%`} tone="good" />
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
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
            UI only. No push, email, mobile or backend notification service is enabled yet.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Setting label="Guaranteed arbitrage found" value="On" />
            <Setting label="Minimum margin" value={`${data?.notificationSettings.minimumMarginPercent ?? 1}%`} />
            <Setting label="Minimum profit" value={money(data?.notificationSettings.minimumProfit ?? 25)} />
            <Setting label="Maximum stake" value={money(investment)} />
            <Setting label="Preferred sportsbooks" value={data?.summary.verifiedSportsbooks.join(', ') || 'Not verified'} />
            <Setting label="Odds age" value={`${staleMinutes} minutes`} />
            <Setting label="Browser notification" value="Placeholder" />
            <Setting label="Email" value="Placeholder" />
            <Setting label="Mobile" value="Future placeholder" />
          </div>
        </section>
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'neutral' }) {
  return (
    <div className="rounded-xl bg-slate-950/70 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-black ${tone === 'good' ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 font-bold text-white">{value}</p>
    </div>
  )
}

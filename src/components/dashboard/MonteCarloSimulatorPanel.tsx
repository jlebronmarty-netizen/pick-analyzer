'use client'

import { useEffect, useState } from 'react'

type Simulation = {
  success: boolean
  bankroll: number
  simulations: number
  picksUsed: number
  summary: {
    averageProfit: number
    averageRoi: number
    probabilityOfProfit: number
    probabilityOfRuin: number
    averageDrawdown: number
    worstCase: number
    medianCase: number
    bestCase: number
    roiWorstCase: number
    roiMedianCase: number
    roiBestCase: number
  }
}

function money(v?: number) {
  return `$${Number(v ?? 0).toFixed(2)}`
}

function pct(v?: number) {
  return `${Number(v ?? 0).toFixed(2)}%`
}

export default function MonteCarloSimulatorPanel() {
  const [bankroll, setBankroll] = useState(1000)
  const [simulations, setSimulations] = useState(10000)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Simulation | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)

        const response = await fetch(
          `/api/simulator/monte-carlo?bankroll=${bankroll}&simulations=${simulations}`,
          {
            cache: 'no-store',
          }
        )

        const json = await response.json()

        if (json.success) {
          setData(json)
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [bankroll, simulations])

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-slate-400">
        Running Monte Carlo Simulation...
      </section>
    )
  }

  if (!data) {
    return null
  }

  const s = data.summary

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">

      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-semibold">
            Monte Carlo Engine
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            10,000 Outcome Simulation
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Simulates thousands of betting sequences using the current AI model.
          </p>
        </div>

        <div className="flex gap-3">

          <select
            value={bankroll}
            onChange={(e)=>setBankroll(Number(e.target.value))}
            className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
          >
            <option value={500}>$500</option>
            <option value={1000}>$1,000</option>
            <option value={2500}>$2,500</option>
            <option value={5000}>$5,000</option>
          </select>

          <select
            value={simulations}
            onChange={(e)=>setSimulations(Number(e.target.value))}
            className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-white"
          >
            <option value={1000}>1,000</option>
            <option value={5000}>5,000</option>
            <option value={10000}>10,000</option>
            <option value={25000}>25,000</option>
          </select>

        </div>

      </div>

      <div className="mt-6 grid md:grid-cols-4 gap-3">

        <Card
          title="Probability of Profit"
          value={pct(s.probabilityOfProfit)}
        />

        <Card
          title="Probability of Ruin"
          value={pct(s.probabilityOfRuin)}
        />

        <Card
          title="Average ROI"
          value={pct(s.averageRoi)}
        />

        <Card
          title="Average Drawdown"
          value={pct(s.averageDrawdown)}
        />

      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-4">

        <Result
          title="Worst Case (5%)"
          value={money(s.worstCase)}
          color="text-red-300"
        />

        <Result
          title="Median"
          value={money(s.medianCase)}
          color="text-yellow-300"
        />

        <Result
          title="Best Case (95%)"
          value={money(s.bestCase)}
          color="text-emerald-300"
        />

      </div>

      <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-5">

        <p className="text-cyan-300 font-bold">
          AI Conclusion
        </p>

        <p className="mt-3 text-slate-300 leading-7">

          Average profit:

          <span className="font-bold text-white">
            {' '}
            {money(s.averageProfit)}
          </span>

          <br />

          Average ROI:

          <span className="font-bold text-white">
            {' '}
            {pct(s.averageRoi)}
          </span>

          <br />

          Based on

          <span className="font-bold text-white">
            {' '}
            {data.simulations.toLocaleString()}
          </span>

          simulations using

          <span className="font-bold text-white">
            {' '}
            {data.picksUsed}
          </span>

          AI-selected picks.

        </p>

      </div>

    </section>
  )
}

function Card({
  title,
  value,
}:{
  title:string
  value:string
}){

  return(
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-white">
        {value}
      </p>
    </div>
  )
}

function Result({
  title,
  value,
  color,
}:{
  title:string
  value:string
  color:string
}){

  return(
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">

      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className={`mt-3 text-3xl font-black ${color}`}>
        {value}
      </p>

    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'

export default function AIModelCenter() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/model/status')
      .then(r => r.json())
      .then(setData)
  }, [])

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        Loading AI Model...
      </div>
    )
  }

  const weights = data.weights

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">

      <h2 className="text-2xl font-bold text-white">
        AI Model Center
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-5">

        {Object.entries(weights).map(([factor,value])=>(
          <div
            key={factor}
            className="rounded-lg bg-slate-950 p-4"
          >
            <div className="text-xs text-slate-400">
              {factor}
            </div>

            <div className="mt-2 text-xl font-bold text-emerald-400">
              {Number(value).toFixed(3)}
            </div>

          </div>
        ))}

      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">

        <div className="rounded-lg bg-slate-950 p-4">
          <div className="text-xs text-slate-400">
            Calibration Score
          </div>

          <div className="mt-2 text-2xl font-bold text-white">
            {data.calibration.overall.calibrationScore.toFixed(2)}
          </div>

        </div>

        <div className="rounded-lg bg-slate-950 p-4">
          <div className="text-xs text-slate-400">
            Model Version
          </div>

          <div className="mt-2 text-2xl font-bold text-white">
            {data.latestVersion?.version ?? '-'}
          </div>

        </div>

        <div className="rounded-lg bg-slate-950 p-4">
          <div className="text-xs text-slate-400">
            Status
          </div>

          <div className="mt-2 text-2xl font-bold text-emerald-400">
            {data.calibration.overall.modelStatus}
          </div>

        </div>

      </div>

    </div>
  )
}
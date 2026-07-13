'use client'

import { useState } from 'react'

export default function AutoModelTuningPanel() {
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)

    const response = await fetch('/api/model/autotune', {
      method: 'POST',
    })

    const result = await response.json()

    alert(JSON.stringify(result, null, 2))

    setRunning(false)
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-xl font-bold text-white">
        Auto Model Tuning V3
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Tests dozens of weight combinations and automatically
        keeps the highest scoring configuration.
      </p>

      <button
        onClick={run}
        disabled={running}
        className="mt-5 rounded-lg bg-emerald-600 px-5 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {running ? 'Running...' : 'Run Auto Tuning'}
      </button>
    </div>
  )
}
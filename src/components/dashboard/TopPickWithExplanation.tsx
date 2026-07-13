'use client'

import { useState } from 'react'
import PickExplanationCard from './PickExplanationCard'

export default function TopPickWithExplanation({
  pick,
}: {
  pick: any
}) {
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState<any>(null)

  async function explain() {
    if (explanation) {
      setExplanation(null)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/picks/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pick),
      })

      const json = await response.json()

      if (json.success) {
        setExplanation(json)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

        <div className="flex items-center justify-between">

          <div>

            <div className="text-xl font-bold text-white">
              {pick.team}
            </div>

            <div className="text-sm text-slate-400">
              vs {pick.opponent}
            </div>

          </div>

          <button
            onClick={explain}
            disabled={loading}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {loading
              ? 'Analyzing...'
              : explanation
              ? 'Hide Analysis'
              : 'AI Analysis'}
          </button>

        </div>

      </div>

      {explanation && (
        <PickExplanationCard
          explanation={explanation}
        />
      )}

    </div>
  )
}
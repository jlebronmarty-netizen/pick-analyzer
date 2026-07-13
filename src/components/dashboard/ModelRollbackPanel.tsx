'use client'

import { useEffect, useState } from 'react'

type Version = {
  version: number
  roi: number
  win_rate: number
  created_at: string
}

export default function ModelRollbackPanel() {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/model/rollback/history')
      .then((r) => r.json())
      .then((data) => {
        setVersions(data.versions ?? [])
        setLoading(false)
      })
  }, [])

  async function rollback(version: number) {
    if (!confirm(`Rollback to model version ${version}?`)) return

    const response = await fetch('/api/model/rollback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version,
      }),
    })

    const result = await response.json()

    if (result.success) {
      alert('Rollback completed.')
    } else {
      alert(result.error)
    }
  }

  if (loading) {
    return <div>Loading model versions...</div>
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-xl font-bold text-white">
        Model Rollback Center
      </h2>

      <div className="mt-5 space-y-3">
        {versions.map((version) => (
          <div
            key={version.version}
            className="flex items-center justify-between rounded-lg border border-slate-700 p-4"
          >
            <div>
              <div className="font-bold text-white">
                Version {version.version}
              </div>

              <div className="text-sm text-slate-400">
                ROI {version.roi.toFixed(2)}%
              </div>

              <div className="text-sm text-slate-400">
                Win Rate {version.win_rate.toFixed(2)}%
              </div>
            </div>

            <button
              onClick={() => rollback(version.version)}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
'use client'

import { useSports } from '@/hooks/useSports'

export default function SportsList() {
  const { sports, loading, error } = useSports()

  if (loading) {
    return <p className="text-slate-400">Loading sports...</p>
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900 bg-red-950/40 p-4">
        <p className="font-bold text-red-400">Could not load sports.</p>
        <p className="mt-2 text-sm text-red-200">{error}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {sports.map((sport) => (
        <div
          key={sport.id}
          className="rounded-xl bg-slate-800 p-4 text-center font-bold transition hover:bg-slate-700"
        >
          <p>{sport.name}</p>
          <p className="mt-1 text-xs text-slate-400">{sport.slug}</p>
        </div>
      ))}
    </div>
  )
}
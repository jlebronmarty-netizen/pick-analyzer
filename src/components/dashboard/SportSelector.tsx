'use client'

import { SPORTS, SportKey } from '@/config/sports.config'
import { useSport } from '@/context/SportContext'

export default function SportSelector() {
  const { sportKey, setSportKey, sport } = useSport()

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right lg:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Current Sport
        </p>
        <p className="text-xs font-bold text-white">
          {sport.icon} {sport.shortLabel}
        </p>
      </div>

      <select
        value={sportKey}
        onChange={(event) => setSportKey(event.target.value as SportKey)}
        className="min-w-32 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none transition focus:border-emerald-500/60"
      >
        {SPORTS.filter((item) => item.enabled).map((item) => (
          <option key={item.key} value={item.key}>
            {item.icon} {item.shortLabel}
          </option>
        ))}
      </select>
    </div>
  )
}
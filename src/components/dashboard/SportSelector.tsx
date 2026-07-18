'use client'

import { SPORTS, SportKey } from '@/config/sports.config'
import { useSport } from '@/context/SportContext'

const PRODUCT_SPORTS: Array<{ key: SportKey; status: string; tone: string }> = [
  { key: 'baseball_mlb', status: 'Active', tone: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-100' },
  { key: 'basketball_bsn', status: 'Foundation', tone: 'border-sky-500/30 bg-sky-950/20 text-sky-100' },
  { key: 'basketball_nba', status: 'Planned', tone: 'border-slate-700 bg-slate-900 text-slate-200' },
  { key: 'americanfootball_nfl', status: 'Planned', tone: 'border-slate-700 bg-slate-900 text-slate-200' },
]

export default function SportSelector() {
  const { sportKey, setSportKey } = useSport()

  return (
    <div>
      <select
        value={sportKey}
        onChange={(event) => setSportKey(event.target.value as SportKey)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none xl:hidden"
      >
        {PRODUCT_SPORTS.map((item) => {
          const sport = SPORTS.find((candidate) => candidate.key === item.key)
          return sport ? <option key={sport.key} value={sport.key}>{sport.shortLabel} - {item.status}</option> : null
        })}
      </select>

      <div className="hidden items-center gap-2 xl:flex">
        {PRODUCT_SPORTS.map((item) => {
          const sport = SPORTS.find((candidate) => candidate.key === item.key)
          if (!sport) return null
          const active = sportKey === sport.key
          return (
            <button
              key={sport.key}
              type="button"
              onClick={() => setSportKey(sport.key)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${active ? item.tone : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900 hover:text-white'}`}
              aria-pressed={active}
            >
              <span className="block font-black">{sport.shortLabel}</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] opacity-80">{item.status}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

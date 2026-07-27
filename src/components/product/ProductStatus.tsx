import type { ReactNode } from 'react'

type Tone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'

const toneClass: Record<Tone, string> = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  blue: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
  yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  red: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  gray: 'border-slate-700 bg-slate-900 text-slate-100',
}

export function ProductStatusBadge({ children, tone = 'gray' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-black uppercase ${toneClass[tone]}`}>
      {children}
    </span>
  )
}

export function ProductStatusBanner({
  title,
  detail,
  tone = 'blue',
}: {
  title: string
  detail: string
  tone?: Tone
}) {
  return (
    <div className={`rounded-lg border p-4 text-sm ${toneClass[tone]}`}>
      <p className="font-black uppercase">{title}</p>
      <p className="mt-1 leading-6 normal-case">{detail}</p>
    </div>
  )
}

export function productDateTime(value: string | null | undefined, fallback = 'Not available') {
  if (!value) return fallback
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return fallback
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function sportReadinessLabel(sportKey: string | null | undefined) {
  const key = String(sportKey ?? '').toLowerCase()
  if (key === 'baseball_mlb') return { label: 'LIMITED', tone: 'green' as Tone }
  if (key === 'basketball_bsn') return { label: 'PREVIEW', tone: 'yellow' as Tone }
  if (key.includes('nfl') || key.includes('nhl') || key.includes('soccer') || key.includes('tennis') || key.includes('ufc')) {
    return { label: 'ENGINE NOT CERTIFIED', tone: 'yellow' as Tone }
  }
  return { label: 'INSUFFICIENT DATA', tone: 'gray' as Tone }
}

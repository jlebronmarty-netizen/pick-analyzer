'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  CANONICAL_OPERATING_TIMEZONE,
  DEFAULT_PERSONALIZATION,
  SUPPORTED_SPORTS,
  SUPPORTED_TEAMS,
  SUPPORTED_TIMEZONES,
  normalizePersonalization,
  usePersonalization,
  type PersonalizationContract,
  type PreferredTeam,
} from '@/context/PersonalizationContext'

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="text-sm"><span className="font-bold text-slate-300">{label}</span><select className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-300" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm font-bold text-slate-200"><span>{label}</span><input className="h-5 w-5 accent-emerald-400" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>
}

function applyTeam(list: PreferredTeam[], teamId: string) {
  const team = SUPPORTED_TEAMS.find((item) => item.teamId === teamId)
  if (!team || list.some((item) => item.sportKey === team.sportKey && item.teamId === team.teamId)) return list
  return [...list, team].slice(0, 12)
}

function persistenceLabel(value: string) {
  if (value === 'LOCAL_PERSISTED') return 'Saved on this device'
  if (value === 'LOCAL_UNAVAILABLE') return 'Local storage unavailable'
  if (value === 'RESET') return 'Defaults restored'
  return 'Default local settings'
}

export default function PersonalizationSettingsClient() {
  const { preferences, setPreferences, resetPreferences, t, formatDateTime, formatOdds } = usePersonalization()
  const [draft, setDraft] = useState<PersonalizationContract>(preferences)
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle')
  const teamsBySport = useMemo(() => SUPPORTED_TEAMS.filter((team) => draft.preferredSports.includes(team.sportKey)), [draft.preferredSports])
  const update = (patch: Partial<PersonalizationContract>) => { setSaveState('idle'); setDraft(normalizePersonalization({ ...draft, ...patch }, draft.source)) }
  const save = () => { setPreferences(draft); setSaveState('saved') }
  const reset = () => { setDraft(DEFAULT_PERSONALIZATION); resetPreferences(); setSaveState('saved') }
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-5 text-white md:px-6 md:py-8" data-mc08f-settings="true" data-personalization-contract="personalization_v1">
      <section className="mx-auto grid max-w-5xl gap-5">
        <div className="rounded-lg border border-emerald-400/20 bg-slate-900 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">{t('settings')}</p>
              <h1 className="mt-3 text-3xl font-black md:text-5xl">{t('personalization')}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{t('predictionSafe')}</p>
            </div>
            <Link className="rounded-lg border border-slate-700 px-4 py-3 text-sm font-black text-slate-100 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-300" href="/">{t('backToday')}</Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Mini label={t('canonicalTimezone')} value={CANONICAL_OPERATING_TIMEZONE} />
            <Mini label={t('userDisplayTimezone')} value={draft.timezone} />
            <Mini label={t('localOnly')} value={persistenceLabel(draft.persistenceStatus)} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5" data-mc08f-language="true">
            <h2 className="text-xl font-black">{t('language')}</h2>
            <div className="mt-4 grid gap-4">
              <Select label={t('language')} value={draft.language} onChange={(language) => update({ language: language === 'ES' ? 'ES' : 'EN' })} options={[["EN", t('english')], ["ES", t('spanish')]]} />
              <Select label={t('appearance')} value={draft.appearance} onChange={(appearance) => update({ appearance: appearance as PersonalizationContract['appearance'] })} options={[["SYSTEM", t('system')], ["LIGHT", t('light')], ["DARK", t('dark')]]} />
              <Select label={t('timezone')} value={draft.timezone} onChange={(timezone) => update({ timezone })} options={SUPPORTED_TIMEZONES.map((zone) => [zone, zone])} />
              <Select label={t('oddsFormat')} value={draft.oddsFormat} onChange={(oddsFormat) => update({ oddsFormat: oddsFormat as PersonalizationContract['oddsFormat'] })} options={[["AMERICAN", t('american')], ["DECIMAL", t('decimal')]]} />
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5" data-mc08f-display="true">
            <h2 className="text-xl font-black">{t('displayPreferences')}</h2>
            <div className="mt-4 grid gap-4">
              <Select label={t('homepageDensity')} value={draft.homepageDensity} onChange={(homepageDensity) => update({ homepageDensity: homepageDensity as PersonalizationContract['homepageDensity'] })} options={[["COMFORTABLE", t('comfortable')], ["COMPACT", t('compact')]]} />
              <Toggle label={t('showAdvancedEvidence')} checked={draft.showAdvancedEvidence} onChange={(showAdvancedEvidence) => update({ showAdvancedEvidence })} />
              <Mini label="Example time" value={formatDateTime(new Date().toISOString())} />
              <Mini label="Example odds" value={formatOdds(-125)} />
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5" data-mc08f-preferred-sports="true">
          <h2 className="text-xl font-black">{t('favoriteSports')}</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SUPPORTED_SPORTS.map(([sportKey, label]) => <Toggle key={sportKey} label={label} checked={draft.preferredSports.includes(sportKey)} onChange={(checked) => update({ preferredSports: checked ? [...draft.preferredSports, sportKey] : draft.preferredSports.filter((item) => item !== sportKey), preferredTeams: checked ? draft.preferredTeams : draft.preferredTeams.filter((team) => team.sportKey !== sportKey) })} />)}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5" data-mc08f-preferred-teams="true">
          <h2 className="text-xl font-black">{t('favoriteTeams')}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <Select label={t('addTeam')} value="" onChange={(teamId) => update({ preferredTeams: applyTeam(draft.preferredTeams, teamId) })} options={[["", t('addTeam')], ...teamsBySport.map((team) => [team.teamId, team.teamLabel] as [string, string])]} />
            <p className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">{t('anonymousOnly')}</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {draft.preferredTeams.length ? draft.preferredTeams.map((team) => <div key={`${team.sportKey}:${team.teamId}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"><span className="text-sm font-bold text-slate-100">{team.teamLabel}</span><button className="rounded-md border border-slate-700 px-3 py-2 text-sm font-black outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-300" onClick={() => update({ preferredTeams: draft.preferredTeams.filter((item) => item.teamId !== team.teamId) })}>{t('remove')}</button></div>) : <p className="text-sm text-slate-400">{t('noFavoriteTeams')}</p>}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button className="min-h-11 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-200" onClick={save}>{saveState === 'saved' ? t('saved') : t('save')}</button>
          <button className="min-h-11 rounded-lg border border-slate-700 px-5 py-3 text-sm font-black text-slate-100 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-emerald-300" onClick={reset}>{t('reset')}</button>
          <p className="self-center text-sm text-slate-400">{t('noMutation')}</p>
        </div>
      </section>
    </main>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-black text-white">{value}</p></div>
}

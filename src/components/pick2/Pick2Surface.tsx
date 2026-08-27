import DashboardShell from '@/components/dashboard/DashboardShell'

type Area = 'today' | 'performance' | 'model-lab' | 'data-health'

type Stat = {
  label: string
  value: string
  detail: string
}

type AreaContent = {
  eyebrow: string
  title: string
  summary: string
  status: string
  stats: Stat[]
  sections: Array<{
    title: string
    body: string
    items: string[]
  }>
}

const content: Record<Area, AreaContent> = {
  today: {
    eyebrow: 'Today',
    title: 'Pick Analyzer 2.0',
    summary: 'Current betting decisions are paused while the Pick 2.0 prediction engine and data foundation are rebuilt.',
    status: 'Prediction engine setup pending',
    stats: [
      { label: 'Pick 2 Predictions', value: '0', detail: 'No new-era prediction rows have been activated.' },
      { label: 'Current Recommendations', value: '0', detail: 'Legacy picks are not relabeled as Pick 2 plays.' },
      { label: 'Bet State', value: 'No Bet', detail: 'The market layer is not enabled for Pick 2 recommendations yet.' },
    ],
    sections: [
      {
        title: 'What Today Shows',
        body: 'This page is the future home for current slate probabilities, confidence, expected outcomes and market value.',
        items: [
          'Sports probability output will appear only after the new engine is promoted.',
          'Market comparison will stay separate from model probability until the value layer is ready.',
          'Official legacy workflow does not feed this clean-start surface.',
        ],
      },
      {
        title: 'Current State',
        body: 'The reset is intentionally quiet. Empty states are truthful, and no archived metric is used as a substitute.',
        items: [
          'Statcast setup remains pending.',
          'Pick 2 champion model is none.',
          'Automation remains inactive.',
        ],
      },
    ],
  },
  performance: {
    eyebrow: 'Performance',
    title: 'Model Performance',
    summary: 'Pick 2 performance starts at zero and will only count predictions generated after the new engine is activated.',
    status: 'Clean-start metrics',
    stats: [
      { label: 'Predictions', value: '0', detail: 'No Pick 2 prediction sample exists yet.' },
      { label: 'Evaluated', value: '0', detail: 'No settled Pick 2 rows are available.' },
      { label: 'Accuracy', value: 'N/A', detail: 'Accuracy is withheld until evaluated Pick 2 rows exist.' },
      { label: 'Brier', value: 'N/A', detail: 'No probability calibration sample exists for Pick 2.' },
      { label: 'Log Loss', value: 'N/A', detail: 'No evaluated probability rows exist for Pick 2.' },
      { label: 'ROI', value: 'N/A', detail: 'ROI is reserved for value-layer bets after policy activation.' },
    ],
    sections: [
      {
        title: 'Metric Boundary',
        body: 'Legacy settled history remains audit data. It is not counted as Pick 2 model performance.',
        items: [
          'Forward and historical samples will be separated.',
          'Market-specific performance will remain N/A until enough new-era outcomes settle.',
          'Calibration views will stay empty until a Pick 2 calibration sample exists.',
        ],
      },
    ],
  },
  'model-lab': {
    eyebrow: 'Model Lab',
    title: 'Model Lab',
    summary: 'No Pick 2 champion model has been promoted yet.',
    status: 'Champion model: none',
    stats: [
      { label: 'Champion', value: 'None', detail: 'No model is currently eligible to power Pick 2 recommendations.' },
      { label: 'Challengers', value: '0', detail: 'Training runs remain pending.' },
      { label: 'Promotions', value: '0', detail: 'No promotion candidate is exposed to product.' },
    ],
    sections: [
      {
        title: 'Future Lab Scope',
        body: 'This area will hold champion and challenger models, sealed holdouts, feature sets, validation and promotion review.',
        items: [
          'Legacy raw, calibrated and shadow artifacts are not shown as current champions.',
          'Model promotion remains an explicit gated event.',
          'Feature and calibration versions will be visible after Pick 2 training begins.',
        ],
      },
    ],
  },
  'data-health': {
    eyebrow: 'Data Health',
    title: 'Data Health',
    summary: 'Canonical data readiness is shown without claiming that the new Statcast-backed foundation is active.',
    status: 'Statcast setup pending',
    stats: [
      { label: 'Statcast', value: 'Not Yet Imported', detail: 'RESET-04 and RESET-05 remain pending.' },
      { label: 'Provider Calls', value: '0', detail: 'This surface uses static reset status only.' },
      { label: 'DB Mutations', value: '0', detail: 'No data import or schema change is performed.' },
    ],
    sections: [
      {
        title: 'Readiness Domains',
        body: 'The future health view will consolidate canonical games, results, features, odds, lineups, weather, injuries and provider status.',
        items: [
          'Current canonical history remains preserved.',
          'Feature freshness will appear after the new feature pipeline exists.',
          'Weather and injury health remain pending source approval.',
        ],
      },
      {
        title: 'Reset Boundary',
        body: 'The UI reset does not import data, apply migrations, create predictions or activate automation.',
        items: [
          'Backend audit routes remain available outside normal navigation.',
          'Legacy rows are unchanged.',
          'Pick 2 data ingest is still blocked.',
        ],
      },
    ],
  },
}

function Metric({ stat }: { stat: Stat }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
      <p className="mt-2 text-3xl font-black text-white">{stat.value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{stat.detail}</p>
    </div>
  )
}

export default function Pick2Surface({ area }: { area: Area }) {
  const page = content[area]

  return (
    <DashboardShell>
      <section className="rounded-lg border border-slate-800 bg-slate-950/80 p-6 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">{page.eyebrow}</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <h1 className="text-4xl font-black text-white md:text-5xl">{page.title}</h1>
            <p className="mt-4 text-base leading-7 text-slate-300 md:text-lg">{page.summary}</p>
          </div>
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-50">
            {page.status}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {page.stats.map((stat) => (
          <Metric key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {page.sections.map((section) => (
          <article key={section.title} className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-2xl font-black text-white">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{section.body}</p>
            <div className="mt-5 grid gap-3">
              {section.items.map((item) => (
                <p key={item} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm leading-6 text-slate-300">
                  {item}
                </p>
              ))}
            </div>
          </article>
        ))}
      </section>
    </DashboardShell>
  )
}

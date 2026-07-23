import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Historical Diagnostics | Pick Analyzer',
  description: 'Read-only historical baseball reconstruction diagnostics.',
}

function fmt(value: unknown, fallback = 'n/a') {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{fmt(value)}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 shadow-xl shadow-black/20">
      <h2 className="mb-4 text-base font-bold text-white">{title}</h2>
      {children}
    </section>
  )
}

export default async function HistoricalDiagnosticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ gameId?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const [{ getRetrosheetGameEngineDiagnostics }, { getRetrosheetHistoricalFeatureStoreDiagnostics }] = await Promise.all([
    import('@/services/retrosheet-game-reconstruction.service'),
    import('@/services/retrosheet-historical-feature-store.service'),
  ])
  const data = await getRetrosheetGameEngineDiagnostics({ gameId: params.gameId, limit: 25 })
  const featureData = await getRetrosheetHistoricalFeatureStoreDiagnostics({ gameId: params.gameId, limit: 1 })
  const coverage = data.coverage

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-sm font-bold text-cyan-300">Internal Admin</p>
          <h1 className="mt-1 text-3xl font-black text-white">Historical Diagnostics</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Read-only Retrosheet game reconstruction status. Historical-only, postgame-known, zero provider calls.
          </p>
        </header>

        <Panel title="Health">
          <div className="grid gap-2 md:grid-cols-4">
            <Metric label="Status" value={data.health.status} />
            <Metric label="Source Files" value={data.health.sourceFiles ?? 0} />
            <Metric label="Provider Calls" value={data.providerCallsMade} />
            <Metric label="Remote Mutations" value={data.remoteMutationsMade} />
          </div>
        </Panel>

        <Panel title="Coverage">
          <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-6">
            <Metric label="Games" value={coverage.games} />
            <Metric label="Valid" value={coverage.valid} />
            <Metric label="Warnings" value={coverage.validWithWarnings} />
            <Metric label="Quarantined" value={coverage.quarantined} />
            <Metric label="Lineups" value={coverage.lineups} />
            <Metric label="Starters" value={coverage.starters} />
            <Metric label="Substitutions" value={coverage.substitutions} />
            <Metric label="Pitchers" value={coverage.pitcherAppearances} />
            <Metric label="Batters" value={coverage.batterAppearances} />
            <Metric label="Plays" value={coverage.plays} />
            <Metric label="Conflicts" value={coverage.errors} />
            <Metric label="Warnings" value={coverage.warnings} />
          </div>
        </Panel>

        <Panel title="Historical Feature Store">
          <div className="grid gap-2 md:grid-cols-4">
            <Metric label="Status" value={featureData.status} />
            <Metric label="Stored Snapshots" value={featureData.summary.storedSnapshots} />
            <Metric label="Feature Definitions" value={featureData.summary.featureDefinitions} />
            <Metric label="Provider Calls" value={featureData.providerCallsMade} />
          </div>
        </Panel>

        <Panel title="Games">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Game</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Matchup</th>
                  <th className="px-2 py-2">Score</th>
                  <th className="px-2 py-2">Plays</th>
                  <th className="px-2 py-2">Subs</th>
                  <th className="px-2 py-2">Validation</th>
                </tr>
              </thead>
              <tbody>
                {data.games.map((game) => (
                  <tr key={game.id} className="border-t border-zinc-900">
                    <td className="px-2 py-2 font-semibold text-cyan-200">{game.id}</td>
                    <td className="px-2 py-2 text-zinc-300">{game.date}</td>
                    <td className="px-2 py-2 text-zinc-300">{game.matchup}</td>
                    <td className="px-2 py-2 text-zinc-300">{game.finalScore.away}-{game.finalScore.home}</td>
                    <td className="px-2 py-2 text-zinc-300">{game.plays}</td>
                    <td className="px-2 py-2 text-zinc-300">{game.substitutions}</td>
                    <td className="px-2 py-2 text-zinc-300">{game.validationStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {data.selectedGame ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Selected Game State">
              <pre className="overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-200">{JSON.stringify(data.gameState, null, 2)}</pre>
            </Panel>
            <Panel title="Selected Starters">
              <pre className="overflow-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-200">{JSON.stringify(data.starters, null, 2)}</pre>
            </Panel>
          </div>
        ) : null}
      </div>
    </main>
  )
}

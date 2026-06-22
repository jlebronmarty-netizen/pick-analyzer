import AnalyticsPanel from '@/components/dashboard/AnalyticsPanel'
import SportsList from '@/components/dashboard/SportsList'
import TeamStatsPanel from '@/components/dashboard/TeamStatsPanel'
import UpcomingGames from '@/components/dashboard/UpcomingGames'

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Pick Analyzer Dashboard</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sports data, prediction engine results, model performance and ROI
            tracking.
          </p>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-bold text-white">Model Performance</h2>
            <p className="text-sm text-slate-400">
              Tracks recommended picks, win rate, profit and ROI.
            </p>
          </div>

          <AnalyticsPanel />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-bold text-white">Upcoming MLB Games</h2>
            <p className="text-sm text-slate-400">
              Live odds, implied probability, model probability, edge, EV and
              recommended picks.
            </p>
          </div>

          <UpcomingGames />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-3">
            <div>
              <h2 className="text-xl font-bold text-white">Sports</h2>
              <p className="text-sm text-slate-400">
                Sports currently available in the platform.
              </p>
            </div>

            <SportsList />
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-xl font-bold text-white">Team Stats</h2>
              <p className="text-sm text-slate-400">
                Calculated from synced game results.
              </p>
            </div>

            <TeamStatsPanel />
          </div>
        </section>
      </div>
    </main>
  )
}
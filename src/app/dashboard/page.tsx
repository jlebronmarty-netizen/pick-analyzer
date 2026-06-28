import AICopilotPanel from '@/components/dashboard/AICopilotPanel'
import AnalyticsChartsPanel from '@/components/dashboard/AnalyticsChartsPanel'
import AnalyticsPanel from '@/components/dashboard/AnalyticsPanel'
import ClvAnalyticsPanel from '@/components/dashboard/ClvAnalyticsPanel'
import DashboardEliteHeader from '@/components/dashboard/DashboardEliteHeader'
import DashboardProPanel from '@/components/dashboard/DashboardProPanel'
import LiveOddsShoppingPanel from '@/components/dashboard/LiveOddsShoppingPanel'
import PlayOfTheDayPanel from '@/components/dashboard/PlayOfTheDayPanel'
import PortfolioElitePanel from '@/components/dashboard/PortfolioElitePanel'
import SmartParlaysPanel from '@/components/dashboard/SmartParlaysPanel'
import SportsList from '@/components/dashboard/SportsList'
import TeamStatsPanel from '@/components/dashboard/TeamStatsPanel'
import UpcomingGames from '@/components/dashboard/UpcomingGames'

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <DashboardEliteHeader />

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <PlayOfTheDayPanel />
          </div>

          <div className="xl:col-span-7">
            <LiveOddsShoppingPanel />
          </div>
        </section>

        <section className="space-y-3">
          <AICopilotPanel />
        </section>

        <section className="space-y-3">
          <PortfolioElitePanel />
        </section>

        <section className="space-y-3">
          <SmartParlaysPanel />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-bold text-white">Closing Line Value</h2>
            <p className="text-sm text-slate-400">
              Tracks whether your model is beating the market before game time.
            </p>
          </div>

          <ClvAnalyticsPanel />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-bold text-white">Dashboard Pro</h2>
            <p className="text-sm text-slate-400">
              Best bets, top EV picks, top confidence picks and model summary.
            </p>
          </div>

          <DashboardProPanel />
        </section>

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
            <h2 className="text-xl font-bold text-white">
              Advanced Analytics
            </h2>
            <p className="text-sm text-slate-400">
              Profit curve, daily performance, sport performance and team ROI
              rankings.
            </p>
          </div>

          <AnalyticsChartsPanel />
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
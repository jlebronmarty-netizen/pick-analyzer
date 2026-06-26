export default function DashboardEliteHeader() {
  return (
    <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30 p-6 shadow-xl shadow-emerald-950/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
            Pick Analyzer Elite
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
            Sports Trading Dashboard
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Live value bets, sharp money signals, odds shopping, portfolio
            construction, CLV tracking and model performance in one command
            center.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 lg:min-w-[520px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-slate-500">Mode</p>
            <p className="mt-1 font-bold text-emerald-400">Elite</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-slate-500">Engine</p>
            <p className="mt-1 font-bold text-white">V4</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-slate-500">Signals</p>
            <p className="mt-1 font-bold text-white">Sharp</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-slate-500">Status</p>
            <p className="mt-1 font-bold text-emerald-400">Live</p>
          </div>
        </div>
      </div>
    </div>
  )
}
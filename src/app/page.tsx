export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto p-4">

        <h1 className="text-4xl font-bold mb-2">
          Pick Analyzer
        </h1>

        <p className="text-slate-400 mb-6">
          AI Sports Analytics Platform
        </p>

        <div className="bg-slate-900 rounded-xl p-4 mb-4 border border-slate-800">
          <h2 className="text-xl font-semibold mb-2">
            Today's Best Pick
          </h2>

          <p className="text-green-400 text-lg">
            San Germán ML
          </p>

          <p className="text-slate-400">
            Confidence: 8.2 / 10
          </p>
        </div>

        <div className="bg-slate-900 rounded-xl p-4 mb-4 border border-slate-800">
          <h2 className="text-xl font-semibold mb-2">
            Upcoming Games
          </h2>

          <div className="space-y-3">

            <div className="border-b border-slate-800 pb-2">
              <p>Gigantes vs Santurce</p>
              <p className="text-slate-400 text-sm">
                Carolina 52%
              </p>
            </div>

            <div className="border-b border-slate-800 pb-2">
              <p>Caguas vs Bayamón</p>
              <p className="text-slate-400 text-sm">
                Bayamón 54%
              </p>
            </div>

            <div>
              <p>San Germán vs Arecibo</p>
              <p className="text-slate-400 text-sm">
                San Germán 62%
              </p>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}
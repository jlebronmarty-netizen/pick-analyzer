export default function MlbLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <section className="rounded-3xl border border-sky-500/20 bg-slate-950 p-6 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-300">MLB Decision Board V1</p>
        <h1 className="mt-2 text-2xl font-black text-white md:text-3xl">Cargando decisiones MLB…</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Consultando juegos, odds y proyecciones actuales. No se muestran líneas de relleno mientras llega la data real.
        </p>
      </section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" />
        ))}
      </div>
      <div className="h-52 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40" />
    </div>
  )
}

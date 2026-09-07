'use client'

export default function MlbError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-3xl border border-rose-500/25 bg-rose-500/5 p-6 md:p-8" role="alert">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-300">MLB Decision Board</p>
      <h1 className="mt-2 text-2xl font-black text-white">No se pudo cargar la data actual.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        El board no va a sustituir la data faltante con líneas demo. Puedes volver a intentar la lectura del feed actual.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-sm font-black text-rose-100 hover:bg-rose-400/20"
      >
        Reintentar
      </button>
    </div>
  )
}

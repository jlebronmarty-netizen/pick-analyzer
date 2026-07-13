type DashboardSectionProps = {
  id?: string
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}

export default function DashboardSection({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
}: DashboardSectionProps) {
  return (
    <section id={id} className="space-y-5 scroll-mt-24">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
              {eyebrow}
            </p>
          )}

          <h2 className="mt-1 text-3xl font-black tracking-tight text-white">
            {title}
          </h2>

          {description && (
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              {description}
            </p>
          )}
        </div>

        {action && <div>{action}</div>}
      </div>

      {children}
    </section>
  )
}
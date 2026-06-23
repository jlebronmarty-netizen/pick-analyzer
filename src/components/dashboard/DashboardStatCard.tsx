type DashboardStatCardProps = {
  label: string
  value: string | number
  description?: string
}

export default function DashboardStatCard({
  label,
  value,
  description,
}: DashboardStatCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {description && <p className="mt-2 text-xs text-slate-500">{description}</p>}
    </div>
  )
}
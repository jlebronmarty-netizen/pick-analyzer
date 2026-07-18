'use client'

import { ReactNode, useState } from 'react'

export default function DeveloperDetails({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  const [opened, setOpened] = useState(false)

  return (
    <details
      className="rounded-lg border border-slate-800 bg-slate-950/40 p-5"
      onToggle={(event) => setOpened((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black text-white">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
            Developer Mode
          </span>
        </div>
      </summary>

      {opened ? <div className="mt-5 space-y-5">{children}</div> : null}
    </details>
  )
}

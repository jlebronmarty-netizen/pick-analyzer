'use client'

import { useEffect, useState } from 'react'

type Status = 'online' | 'offline' | 'warning' | 'loading'

type Service = {
  name: string
  status: Status
  detail: string
}

function Dot({ status }: { status: Status }) {
  const color =
    status === 'online'
      ? 'bg-emerald-500'
      : status === 'warning'
        ? 'bg-amber-500'
        : status === 'offline'
          ? 'bg-red-500'
          : 'bg-slate-500'

  return <span className={`h-3 w-3 rounded-full ${color}`} />
}

export default function SystemStatusPanel() {
  const [services, setServices] = useState<Service[]>([
    {
      name: 'Dashboard API',
      status: 'loading',
      detail: 'Checking...',
    },
    {
      name: 'Odds API',
      status: 'loading',
      detail: 'Checking...',
    },
    {
      name: 'AI Engine',
      status: 'loading',
      detail: 'Checking...',
    },
    {
      name: 'Prediction Engine',
      status: 'loading',
      detail: 'Checking...',
    },
    {
      name: 'Daily Report',
      status: 'loading',
      detail: 'Checking...',
    },
  ])

  useEffect(() => {
    async function check() {
      const next = [...services]

      async function probe(
        index: number,
        endpoint: string,
        name: string
      ) {
        try {
          const r = await fetch(endpoint, {
            cache: 'no-store',
          })

          const json = await r.json().catch(() => ({}))

          if (r.ok && json.success !== false) {
            next[index] = {
              name,
              status: 'online',
              detail: 'Operational',
            }
          } else if (
            JSON.stringify(json).includes('OUT_OF_USAGE_CREDITS')
          ) {
            next[index] = {
              name,
              status: 'warning',
              detail: 'Quota exceeded',
            }
          } else {
            next[index] = {
              name,
              status: 'offline',
              detail: 'Unavailable',
            }
          }
        } catch {
          next[index] = {
            name,
            status: 'offline',
            detail: 'Offline',
          }
        }
      }

      await Promise.all([
        probe(0, '/api/dashboard', 'Dashboard API'),
        probe(1, '/api/odds', 'Odds API'),
        probe(2, '/api/ai/copilot', 'AI Engine'),
        probe(3, '/api/predictions/top', 'Prediction Engine'),
        probe(4, '/api/daily-report', 'Daily Report'),
      ])

      setServices(next)
    }

    check()
  }, [])

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
          System Health
        </p>

        <h2 className="mt-2 text-xl font-black text-white">
          Service Status
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Live status of internal services and external providers.
        </p>
      </div>

      <div className="space-y-3">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Dot status={service.status} />

              <div>
                <p className="font-semibold text-white">
                  {service.name}
                </p>

                <p className="text-xs text-slate-500">
                  {service.detail}
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold uppercase text-slate-400">
              {service.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
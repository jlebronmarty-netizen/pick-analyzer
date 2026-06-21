'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SportsList from '@/components/dashboard/SportsList'

export default function DashboardPage() {
  const [email, setEmail] = useState<string | undefined>('')

  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        window.location.href = '/login'
        return
      }

      setEmail(data.user.email)
    }

    getUser()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-sm text-slate-400">{email}</p>
          </div>

          <button
            onClick={logout}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
          >
            Logout
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-xl font-bold">Today&apos;s Best Pick</h2>
          <p className="text-2xl font-bold text-green-400">San Germán ML</p>
          <p className="text-slate-400">Confidence: 8.2 / 10</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-4 text-xl font-bold">Sports</h2>
          <SportsList />
        </div>
      </div>
    </main>
  )
}
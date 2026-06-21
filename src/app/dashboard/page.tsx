'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-slate-400 text-sm">{email}</p>
          </div>

          <button
            onClick={logout}
            className="bg-slate-800 px-4 py-2 rounded-lg text-sm"
          >
            Logout
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
          <h2 className="text-xl font-bold mb-2">Today&apos;s Best Pick</h2>
          <p className="text-green-400 text-2xl font-bold">San Germán ML</p>
          <p className="text-slate-400">Confidence: 8.2 / 10</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h2 className="text-xl font-bold mb-4">Sports</h2>

          <div className="grid grid-cols-2 gap-3">
            {['MLB', 'NBA', 'NFL', 'Soccer', 'BSN', 'UFC'].map((sport) => (
              <div
                key={sport}
                className="bg-slate-800 rounded-xl p-4 text-center font-bold"
              >
                {sport}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
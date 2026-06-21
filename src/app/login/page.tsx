'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage('Signing in...')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h1 className="text-3xl font-bold mb-2">Login</h1>
        <p className="text-slate-400 mb-6">Welcome back</p>

        <input className="w-full mb-3 p-3 rounded-lg bg-slate-800 border border-slate-700" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <input className="w-full mb-4 p-3 rounded-lg bg-slate-800 border border-slate-700" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="w-full bg-green-500 text-slate-950 font-bold p-3 rounded-lg">
          Login
        </button>

        {message && <p className="text-sm text-slate-300 mt-4">{message}</p>}
      </form>
    </main>
  )
}
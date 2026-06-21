'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [message, setMessage] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setMessage('Creating account...')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        username: email.split('@')[0],
        role: 'user',
      })
    }

    setMessage('Account created. Check your email if confirmation is required.')
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <form onSubmit={handleRegister} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h1 className="text-3xl font-bold mb-2">Create Account</h1>
        <p className="text-slate-400 mb-6">Join Pick Analyzer</p>

        <input className="w-full mb-3 p-3 rounded-lg bg-slate-800 border border-slate-700" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />

        <input className="w-full mb-3 p-3 rounded-lg bg-slate-800 border border-slate-700" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <input className="w-full mb-4 p-3 rounded-lg bg-slate-800 border border-slate-700" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="w-full bg-green-500 text-slate-950 font-bold p-3 rounded-lg">
          Register
        </button>

        {message && <p className="text-sm text-slate-300 mt-4">{message}</p>}
      </form>
    </main>
  )
}
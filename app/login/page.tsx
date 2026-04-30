'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/quotes/new')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-brand-stone-light flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-medium text-brand-brown">Jeffries Agriculture</h1>
          <p className="text-sm text-brand-brown/60 mt-1">Quoting Tool</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white border border-brand-stone p-6 flex flex-col gap-4">
          <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide">Sign In</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border border-brand-stone px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green"
              placeholder="you@jeffries.com.au"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border border-brand-stone px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green"
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" loading={loading} className="w-full justify-center">
            Sign In
          </Button>
        </form>

        <p className="text-center text-xs text-brand-brown/40 mt-4">
          Internal use only — Jeffries Agriculture
        </p>
      </div>
    </div>
  )
}

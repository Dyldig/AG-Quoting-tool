'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

export default function ProfilePage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initialising, setInitialising] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email ?? '')
        const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        if (data) setFullName(data.full_name ?? '')
      }
      setInitialising(false)
    }
    load()
  }, [])

  async function handleSave() {
    setLoading(true)
    setSaved(false)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    }
    setLoading(false)
    setSaved(true)
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <h1 className="text-lg font-medium text-brand-brown mb-6">Profile Settings</h1>

      <div className="bg-white border border-brand-stone p-6 max-w-sm flex flex-col gap-4">
        {initialising ? (
          <p className="text-sm text-brand-brown/50">Loading…</p>
        ) : (
          <>
            {email && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-brand-brown uppercase tracking-wide">Account email</span>
                <span className="text-sm text-brand-brown/60">{email}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-brand-brown uppercase tracking-wide" htmlFor="full-name">
                Your name
              </label>
              <input
                id="full-name"
                ref={inputRef}
                type="text"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setSaved(false) }}
                placeholder="e.g. Jane Smith"
                className="border border-brand-stone px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green"
              />
              <p className="text-xs text-brand-brown/40">Displayed on quotes and PDFs as &quot;Prepared by&quot;</p>
            </div>

            <Button onClick={handleSave} loading={loading}>Save</Button>

            {saved && (
              <p className="text-sm text-brand-green font-medium">Saved successfully.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

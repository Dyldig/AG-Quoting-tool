import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/layout/Nav'
import type { Profile } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav profile={profile} />
      <main className="flex-1">{children}</main>
    </div>
  )
}

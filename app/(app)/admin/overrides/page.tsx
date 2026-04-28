import { createClient } from '@/lib/supabase/server'
import { OverridesAdminClient } from './OverridesAdminClient'

export const dynamic = 'force-dynamic'

export default async function OverridesAdminPage() {
  const supabase = await createClient()
  const { data: overrides } = await supabase
    .from('override_log')
    .select('*, quote:quotes(quote_number, customer_name), requester:profiles!requested_by(full_name), approver:profiles!approved_by(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  return (
    <OverridesAdminClient
      overrides={overrides ?? []}
      userRole={profile?.role ?? 'sales_rep'}
      userId={user!.id}
    />
  )
}

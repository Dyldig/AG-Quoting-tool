import { createClient } from '@/lib/supabase/server'
import { QuotesListClient } from './QuotesListClient'
import type { Quote } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function QuotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  const query = supabase
    .from('quotes')
    .select('*, region:regions(name), profile:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: quotes } = await query

  return <QuotesListClient quotes={(quotes as Quote[]) ?? []} userRole={profile?.role ?? 'sales_rep'} />
}

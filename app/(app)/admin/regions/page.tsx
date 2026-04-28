import { createClient } from '@/lib/supabase/server'
import { RegionsAdminClient } from './RegionsAdminClient'
import type { Region, FreightMatrix, Product } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function RegionsAdminPage() {
  const supabase = await createClient()
  const [{ data: regions }, { data: freightMatrix }, { data: products }] = await Promise.all([
    supabase.from('regions').select('*').order('name'),
    supabase.from('freight_matrix').select('*').order('effective_date', { ascending: false }),
    supabase.from('products').select('*').eq('active', true).order('name'),
  ])

  return (
    <RegionsAdminClient
      regions={(regions as Region[]) ?? []}
      freightMatrix={(freightMatrix as FreightMatrix[]) ?? []}
      products={(products as Product[]) ?? []}
    />
  )
}

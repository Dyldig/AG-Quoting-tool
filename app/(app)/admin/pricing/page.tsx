import { createClient } from '@/lib/supabase/server'
import { PricingAdminClient } from './PricingAdminClient'
import type { Product, PricingRule } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function PricingAdminPage() {
  const supabase = await createClient()

  const [{ data: products }, { data: pricingRules }, { data: adjustments }] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('pricing_rules').select('*').order('effective_date', { ascending: false }),
    supabase.from('price_adjustments').select('*, profile:profiles(full_name)').order('applied_at', { ascending: false }).limit(20),
  ])

  return (
    <PricingAdminClient
      products={(products as Product[]) ?? []}
      pricingRules={(pricingRules as PricingRule[]) ?? []}
      adjustments={adjustments ?? []}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { QuoteBuilderClient } from './QuoteBuilderClient'
import type { Product, PricingRule, FreightMatrix, Region, Amendment } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function NewQuotePage() {
  const supabase = await createClient()

  const [
    { data: products },
    { data: pricingRules },
    { data: freightMatrix },
    { data: regions },
    { data: amendments },
  ] = await Promise.all([
    supabase.from('products').select('*').eq('active', true).order('name'),
    supabase.from('pricing_rules').select('*').order('effective_date', { ascending: false }),
    supabase.from('freight_matrix').select('*'),
    supabase.from('regions').select('*').eq('active', true).order('name'),
    supabase.from('amendments').select('*').eq('active', true).order('name'),
  ])

  return (
    <QuoteBuilderClient
      products={(products as Product[]) ?? []}
      pricingRules={(pricingRules as PricingRule[]) ?? []}
      freightMatrix={(freightMatrix as FreightMatrix[]) ?? []}
      regions={(regions as Region[]) ?? []}
      amendments={(amendments as Amendment[]) ?? []}
    />
  )
}

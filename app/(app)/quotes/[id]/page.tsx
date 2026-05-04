import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuoteDetailClient } from './QuoteDetailClient'
import type { Quote, Product, PricingRule, FreightMatrix, Region, Amendment } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const [
    { data: quote },
    { data: products },
    { data: pricingRules },
    { data: freightMatrix },
    { data: regions },
    { data: amendments },
    { data: overrideLogs },
  ] = await Promise.all([
    supabase
      .from('quotes')
      .select('*, region:regions(*), lines:quote_lines(*, product:products(*)), blend:quote_blends(*, amendments:blend_amendments(*, amendment:amendments(*))), profile:profiles!created_by(full_name)')
      .eq('id', params.id)
      .single(),
    supabase.from('products').select('*').eq('active', true).order('name'),
    supabase.from('pricing_rules').select('*').order('effective_date', { ascending: false }),
    supabase.from('freight_matrix').select('*'),
    supabase.from('regions').select('*').eq('active', true).order('name'),
    supabase.from('amendments').select('*').eq('active', true).order('name'),
    supabase.from('override_log').select('*, requester:profiles!requested_by(full_name), approver:profiles!approved_by(full_name)').eq('quote_id', params.id).order('created_at', { ascending: false }),
  ])

  if (!quote) notFound()

  return (
    <QuoteDetailClient
      quote={quote as Quote}
      products={(products as Product[]) ?? []}
      pricingRules={(pricingRules as PricingRule[]) ?? []}
      freightMatrix={(freightMatrix as FreightMatrix[]) ?? []}
      regions={(regions as Region[]) ?? []}
      amendments={(amendments as Amendment[]) ?? []}
      overrideLogs={overrideLogs ?? []}
    />
  )
}

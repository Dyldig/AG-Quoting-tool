import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const HUBSPOT_TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN
const HUBSPOT_BASE = 'https://api.hubapi.com'

async function hubspotRequest(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HubSpot ${method} ${path} failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function POST(request: NextRequest) {
  try {
    const { quoteId } = await request.json()
    if (!quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })

    if (!HUBSPOT_TOKEN) {
      return NextResponse.json({ error: 'HUBSPOT_PRIVATE_APP_TOKEN not configured' }, { status: 500 })
    }

    const supabase = await createServiceClient()
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*, region:regions(*), lines:quote_lines(*, product:products(*))')
      .eq('id', quoteId)
      .single()

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const productSubtotal = (quote.lines ?? []).reduce((s: number, l: any) => s + l.line_total, 0)
    const gstAmount = quote.gst_type === 'ex' ? productSubtotal * 0.1 : 0
    const grandTotal = productSubtotal + gstAmount
    const effectiveTotal = quote.override_total ?? grandTotal

    let dealId = quote.hubspot_deal_id
    let contactId: string | null = null

    // Try to find deal / contact by deal ID or company name
    if (dealId) {
      try {
        const deal = await hubspotRequest(`/crm/v3/objects/deals/${dealId}`)
        // Get associated contact
        const assoc = await hubspotRequest(`/crm/v3/objects/deals/${dealId}/associations/contacts`)
        if (assoc.results?.length > 0) {
          contactId = assoc.results[0].id
        }
      } catch {
        dealId = null
      }
    }

    if (!dealId) {
      // Search for deal by company name
      const searchResult = await hubspotRequest('/crm/v3/objects/deals/search', 'POST', {
        filterGroups: [{ filters: [{ propertyName: 'dealname', operator: 'CONTAINS_TOKEN', value: quote.customer_name }] }],
        limit: 1,
      })
      if (searchResult.results?.length > 0) {
        dealId = searchResult.results[0].id
      } else {
        // Create new deal
        const newDeal = await hubspotRequest('/crm/v3/objects/deals', 'POST', {
          properties: {
            dealname: `${quote.customer_name} — ${quote.quote_number}`,
            amount: effectiveTotal.toFixed(2),
            dealstage: 'presentationscheduled',
            pipeline: 'default',
          },
        })
        dealId = newDeal.id
      }
    }

    // Create/update quote object on the deal
    const quoteProperties = {
      hs_title: quote.quote_number,
      hs_expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      hs_status: quote.status === 'accepted' ? 'APPROVED' : quote.status === 'rejected' ? 'REJECTED' : 'DRAFT',
      hs_currency: 'AUD',
      hs_domain: 'jeffries.com.au',
    }

    // Check if quote already exists on deal
    let hubspotQuoteId: string | null = null
    try {
      const existingQuotes = await hubspotRequest(`/crm/v3/objects/deals/${dealId}/associations/quotes`)
      if (existingQuotes.results?.length > 0) {
        hubspotQuoteId = existingQuotes.results[0].id
      }
    } catch {}

    if (hubspotQuoteId) {
      await hubspotRequest(`/crm/v3/objects/quotes/${hubspotQuoteId}`, 'PATCH', { properties: quoteProperties })
    } else {
      const newQuote = await hubspotRequest('/crm/v3/objects/quotes', 'POST', { properties: quoteProperties })
      hubspotQuoteId = newQuote.id
      // Associate quote with deal
      await hubspotRequest(`/crm/v3/objects/quotes/${hubspotQuoteId}/associations/deals/${dealId}/quote_to_deal`, 'PUT', {})
    }

    // Log engagement on contact timeline
    if (contactId) {
      await hubspotRequest('/engagements/v1/engagements', 'POST', {
        engagement: { active: true, type: 'NOTE', timestamp: Date.now() },
        associations: { contactIds: [parseInt(contactId)], dealIds: [parseInt(dealId)] },
        metadata: {
          body: `Quote ${quote.quote_number} — ${quote.customer_name}\nTotal: ${formatCurrency(effectiveTotal)}\nStatus: ${quote.status}`,
        },
      })
    }

    // Update quote with deal ID and sync timestamp
    await supabase.from('quotes').update({
      hubspot_deal_id: dealId,
      hubspot_synced_at: new Date().toISOString(),
    }).eq('id', quoteId)

    return NextResponse.json({ success: true, dealId, hubspotQuoteId })
  } catch (err: any) {
    console.error('HubSpot sync error:', err)
    return NextResponse.json({ error: 'HubSpot sync failed', detail: err.message }, { status: 500 })
  }
}

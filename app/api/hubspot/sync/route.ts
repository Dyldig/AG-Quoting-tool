import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/pricing'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

const HUBSPOT_TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN
const HUBSPOT_BASE = 'https://api.hubapi.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function hubspotRequest(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HubSpot ${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function hubspotUpload(filename: string, pdfBuffer: Buffer, mimeType = 'application/pdf') {
  const FormData = (await import('form-data')).default
  const form = new FormData()
  form.append('file', pdfBuffer, { filename, contentType: mimeType })
  form.append('options', JSON.stringify({ access: 'PUBLIC_INDEXABLE', overwrite: false }))
  form.append('folderPath', '/jeffries-quotes')

  const res = await fetch(`${HUBSPOT_BASE}/files/v3/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      ...form.getHeaders(),
    },
    body: form as unknown as BodyInit,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HubSpot file upload failed: ${res.status}: ${text}`)
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
      .select('*, region:regions(*), lines:quote_lines(*, product:products(*)), blend:quote_blends(*)')
      .eq('id', quoteId)
      .single()

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // ─── 1. Fetch deal + pre-fill missing quote fields ───────────────────────
    let dealId: string | null = quote.hubspot_deal_id
    let contactId: string | null = null
    const missingFieldUpdates: Record<string, string> = {}

    if (dealId) {
      try {
        const [_deal, assocRes] = await Promise.all([
          hubspotRequest(`/crm/v3/objects/deals/${dealId}?properties=dealname,amount`),
          hubspotRequest(`/crm/v3/objects/deals/${dealId}/associations/contacts`),
        ])

        if (assocRes.results?.length > 0) {
          contactId = assocRes.results[0].id

          // Fetch contact properties to pre-fill quote fields
          const contact = await hubspotRequest(
            `/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,company`
          )
          const props = contact.properties ?? {}
          const fullName = [props.firstname, props.lastname].filter(Boolean).join(' ')

          if (!quote.customer_name && (props.company || fullName)) {
            missingFieldUpdates.customer_name = props.company || fullName
          }
          if (!quote.contact_name && fullName) {
            missingFieldUpdates.contact_name = fullName
          }
          if (!quote.email && props.email) {
            missingFieldUpdates.email = props.email
          }
        }
      } catch {
        // Non-fatal — continue without pre-fill
        dealId = null
      }
    }

    // Apply pre-fill updates to Supabase (only empty fields)
    if (Object.keys(missingFieldUpdates).length > 0) {
      await supabase.from('quotes').update(missingFieldUpdates).eq('id', quoteId)
      // Merge into local quote object for use in note body below
      Object.assign(quote, missingFieldUpdates)
    }

    // ─── Compute totals ──────────────────────────────────────────────────────
    const productSubtotal = (quote.lines ?? []).reduce((s: number, l: any) => s + l.line_total, 0)
    const blendTotal = quote.blend
      ? (quote.blend.blend_fee_total ?? 0) + 0 // amendments total not loaded in this query
      : 0
    const subtotal = productSubtotal + blendTotal
    const gstAmount = quote.gst_type === 'ex' ? subtotal * 0.1 : 0
    const grandTotal = subtotal + gstAmount
    const effectiveTotal = quote.override_total ?? grandTotal

    // ─── 2. Find or create deal ───────────────────────────────────────────────
    if (!dealId) {
      const searchResult = await hubspotRequest('/crm/v3/objects/deals/search', 'POST', {
        filterGroups: [{ filters: [{ propertyName: 'dealname', operator: 'CONTAINS_TOKEN', value: quote.customer_name }] }],
        limit: 1,
      })
      if (searchResult.results?.length > 0) {
        dealId = searchResult.results[0].id
        // Try to get contact
        try {
          const assoc = await hubspotRequest(`/crm/v3/objects/deals/${dealId}/associations/contacts`)
          if (assoc.results?.length > 0) contactId = assoc.results[0].id
        } catch {}
      } else {
        const newDeal = await hubspotRequest('/crm/v3/objects/deals', 'POST', {
          properties: {
            dealname: `${quote.customer_name}${quote.quote_name ? ` — ${quote.quote_name}` : ''} — ${quote.quote_number}`,
            amount: effectiveTotal.toFixed(2),
            dealstage: 'presentationscheduled',
            pipeline: 'default',
          },
        })
        dealId = newDeal.id
      }
    }

    // ─── Create/update HubSpot quote object ──────────────────────────────────
    const validUntil = quote.valid_until
      ? new Date(quote.valid_until).toISOString().split('T')[0]
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const quoteProperties = {
      hs_title: quote.quote_name
        ? `${quote.quote_number} — ${quote.quote_name}`
        : quote.quote_number,
      hs_expiration_date: validUntil,
      hs_status: quote.status === 'accepted' ? 'APPROVED' : quote.status === 'rejected' ? 'REJECTED' : 'DRAFT',
      hs_currency: 'AUD',
      hs_domain: 'jeffries.com.au',
    }

    let hubspotQuoteId: string | null = null
    try {
      const existingQuotes = await hubspotRequest(`/crm/v3/objects/deals/${dealId}/associations/quotes`)
      if (existingQuotes.results?.length > 0) hubspotQuoteId = existingQuotes.results[0].id
    } catch {}

    if (hubspotQuoteId) {
      await hubspotRequest(`/crm/v3/objects/quotes/${hubspotQuoteId}`, 'PATCH', { properties: quoteProperties })
    } else {
      const newHsQuote = await hubspotRequest('/crm/v3/objects/quotes', 'POST', { properties: quoteProperties })
      hubspotQuoteId = newHsQuote.id
      await hubspotRequest(
        `/crm/v3/objects/quotes/${hubspotQuoteId}/associations/deals/${dealId}/quote_to_deal`,
        'PUT',
        {}
      )
    }

    // ─── 3. Generate customer PDF and upload to HubSpot Files API ────────────
    let pdfFileUrl: string | null = null
    try {
      const pdfRes = await fetch(`${APP_URL}/api/quotes/${quoteId}/pdf?view=customer`)
      if (pdfRes.ok) {
        const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
        const filename = `${quote.quote_number}-quote.pdf`
        const uploaded = await hubspotUpload(filename, pdfBuffer)
        pdfFileUrl = uploaded.url ?? null
      }
    } catch (uploadErr) {
      console.warn('HubSpot PDF upload failed (non-fatal):', uploadErr)
    }

    // ─── 4. Email via HubSpot Single Send → fall back to Resend ─────────────
    let emailMethod: 'hubspot' | 'resend' | 'none' = 'none'
    if (quote.email) {
      let hubspotEmailSent = false
      try {
        await hubspotRequest('/marketing/v3/transactional/single-email/send', 'POST', {
          emailId: process.env.HUBSPOT_QUOTE_EMAIL_TEMPLATE_ID ?? '',
          message: {
            to: quote.email,
            sendId: `${quoteId}-${Date.now()}`,
          },
          customProperties: [
            { name: 'quote_number', value: quote.quote_number },
            { name: 'quote_name', value: quote.quote_name ?? '' },
            { name: 'customer_name', value: quote.customer_name },
            { name: 'total', value: formatCurrency(effectiveTotal) },
          ],
        })
        hubspotEmailSent = true
        emailMethod = 'hubspot'
      } catch {
        // HubSpot template not configured or send failed — fall back to Resend silently
      }

      if (!hubspotEmailSent) {
        try {
          const emailRes = await fetch(`${APP_URL}/api/quotes/${quoteId}/email`, { method: 'POST' })
          if (emailRes.ok) emailMethod = 'resend'
        } catch {
          // Non-fatal
        }
      }
    }

    // ─── 5. Build note body ───────────────────────────────────────────────────
    const regionName = (quote.region as any)?.name ?? '—'
    const productLines = (quote.lines ?? [])
      .map((l: any) => `  • ${l.product?.name ?? 'Product'}: ${l.volume} ${l.uom === 'm3' ? 'm³' : 't'}`)
      .join('\n')
    const blendInfo = quote.blend
      ? `${quote.blend.classification} blend — ${(quote.blend.total_base_tonnes + quote.blend.total_amendment_tonnes).toFixed(2)} t total`
      : null
    const createdDate = format(new Date(quote.created_at), 'dd MMM yyyy')

    const noteBody = [
      `📋 QUOTE: ${quote.quote_number}${quote.quote_name ? ` — ${quote.quote_name}` : ''}`,
      `👤 Customer: ${quote.customer_name}${quote.contact_name ? ` | ${quote.contact_name}` : ''}${quote.email ? ` | ${quote.email}` : ''}`,
      `📍 Region: ${regionName} | ${quote.fulfilment_type}`,
      `📦 Products:\n${productLines || '  (none)'}`,
      blendInfo ? `🧪 Blend: ${blendInfo}` : null,
      `💰 Subtotal: ${formatCurrency(subtotal)} | GST: ${formatCurrency(gstAmount)} | Total: ${formatCurrency(effectiveTotal)}`,
      quote.override_total != null
        ? `⚠️ Override: ${formatCurrency(quote.override_total)} (variance ${(((quote.override_total - grandTotal) / grandTotal) * 100).toFixed(1)}%)`
        : null,
      pdfFileUrl ? `📎 PDF: ${pdfFileUrl}` : null,
      emailMethod !== 'none' ? `📧 Email sent via: ${emailMethod}` : null,
      `🔗 Generated by Jeffries Quoting Tool | Valid 60 days from ${createdDate}`,
    ]
      .filter(Boolean)
      .join('\n')

    // Post engagement note on contact (and deal)
    if (contactId) {
      try {
        await hubspotRequest('/engagements/v1/engagements', 'POST', {
          engagement: { active: true, type: 'NOTE', timestamp: Date.now() },
          associations: {
            contactIds: [parseInt(contactId)],
            dealIds: [parseInt(dealId!)],
          },
          metadata: { body: noteBody },
        })
      } catch (noteErr) {
        console.warn('HubSpot note failed (non-fatal):', noteErr)
      }
    }

    // Update Supabase: deal ID, sync timestamp
    await supabase.from('quotes').update({
      hubspot_deal_id: dealId,
      hubspot_synced_at: new Date().toISOString(),
    }).eq('id', quoteId)

    return NextResponse.json({
      success: true,
      dealId,
      hubspotQuoteId,
      prefilled: missingFieldUpdates,
      pdfUploaded: pdfFileUrl !== null,
      emailMethod,
    })
  } catch (err: any) {
    console.error('HubSpot sync error:', err)
    return NextResponse.json({ error: 'HubSpot sync failed', detail: err.message }, { status: 500 })
  }
}

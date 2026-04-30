'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeftIcon, DocumentArrowDownIcon, EnvelopeIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pricing'
import { createClient } from '@/lib/supabase/client'
import type { Quote, Region, QuoteStatus, OverrideLog } from '@/lib/types'

interface QuoteDetailClientProps {
  quote: Quote
  regions: Region[]
  overrideLogs: OverrideLog[]
  // Additional props accepted but not rendered directly (passed from page)
  products?: unknown[]
  pricingRules?: unknown[]
  freightMatrix?: unknown[]
  amendments?: unknown[]
}

export function QuoteDetailClient({ quote, regions, overrideLogs }: QuoteDetailClientProps) {
  const [status, setStatus] = useState<QuoteStatus>(quote.status)
  const [updating, setUpdating] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const region = regions.find((r) => r.id === quote.region_id)

  async function updateStatus(newStatus: QuoteStatus) {
    setUpdating(true)
    const { error: err } = await supabase.from('quotes').update({ status: newStatus }).eq('id', quote.id)
    if (err) setError(err.message)
    else setStatus(newStatus)
    setUpdating(false)
  }

  async function sendEmail() {
    setEmailSending(true)
    try {
      const res = await fetch(`/api/quotes/${quote.id}/email`, { method: 'POST' })
      if (!res.ok) throw new Error('Email failed')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setEmailSending(false)
    }
  }

  async function syncHubSpot() {
    setSyncing(true)
    try {
      const res = await fetch('/api/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: quote.id }),
      })
      if (!res.ok) throw new Error('Sync failed')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const productSubtotal = (quote.lines ?? []).reduce((sum, l) => sum + l.line_total, 0)
  const blendTotal = quote.blend ? quote.blend.blend_fee_total + (quote.blend.amendments ?? []).reduce((s, a) => s + a.line_total, 0) : 0
  const subtotal = productSubtotal + blendTotal
  const gstAmount = quote.gst_type === 'ex' ? subtotal * 0.1 : 0
  const grandTotal = subtotal + gstAmount

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/quotes" className="text-brand-brown/50 hover:text-brand-brown">
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-medium text-brand-brown">{quote.quote_number}</h1>
              {quote.quote_name && (
                <span className="text-sm text-brand-green font-medium">{quote.quote_name}</span>
              )}
              <StatusBadge status={status} />
              {quote.override_total != null && <Badge variant="yellow">Override</Badge>}
              {quote.hubspot_synced_at && <Badge variant="stone">HubSpot synced</Badge>}
            </div>
            <p className="text-sm text-brand-brown/50 mt-0.5">
              Created {format(new Date(quote.created_at), 'dd MMM yyyy HH:mm')}
              {quote.valid_until && (
                <span className="ml-3">
                  · Valid until{' '}
                  <span className={new Date(quote.valid_until) < new Date() ? 'text-red-600 font-medium' : 'text-brand-brown'}>
                    {format(new Date(quote.valid_until), 'dd MMM yyyy')}
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <a href={`/api/quotes/${quote.id}/pdf?view=customer`} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">
              <DocumentArrowDownIcon className="w-4 h-4" />
              Customer PDF
            </Button>
          </a>
          <a href={`/api/quotes/${quote.id}/pdf?view=internal`} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">
              <DocumentArrowDownIcon className="w-4 h-4" />
              Internal PDF
            </Button>
          </a>
          <Button variant="secondary" size="sm" onClick={sendEmail} loading={emailSending}>
            <EnvelopeIcon className="w-4 h-4" />
            {quote.email_sent_at ? 'Re-send Email' : 'Send Email'}
          </Button>
          <Button variant="ghost" size="sm" onClick={syncHubSpot} loading={syncing}>
            <ArrowPathIcon className="w-4 h-4" />
            HubSpot Sync
          </Button>
          <Link href={`/quotes/new`}>
            <Button size="sm">Edit Quote</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Customer info */}
          <div className="bg-white border border-brand-stone p-4">
            <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide mb-3">Customer</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Company">{quote.customer_name}</Field>
              <Field label="Contact">{quote.contact_name ?? '—'}</Field>
              <Field label="Email">{quote.email ?? '—'}</Field>
              <Field label="Region">{region?.name ?? '—'}</Field>
              <Field label="Type" className="capitalize">{quote.customer_type}</Field>
              <Field label="Fulfilment" className="capitalize">{quote.fulfilment_type}</Field>
              <Field label="GST">{quote.gst_type === 'ex' ? 'Ex GST' : 'Inc GST'}</Field>
              {quote.hubspot_deal_id && <Field label="HubSpot Deal">{quote.hubspot_deal_id}</Field>}
            </div>
          </div>

          {/* Product lines */}
          <div className="bg-white border border-brand-stone p-4">
            <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide mb-3">Products</h2>
            {(quote.lines ?? []).length === 0 ? (
              <p className="text-sm text-brand-brown/40">No products.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-stone">
                    {['Product', 'Volume', 'Base', 'Freight', 'Total'].map((h) => (
                      <th key={h} className="text-left pb-2 text-xs font-medium text-brand-brown/50 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-stone/30">
                  {(quote.lines ?? []).map((line) => (
                    <tr key={line.id}>
                      <td className="py-2.5">{(line.product as any)?.name ?? '—'}</td>
                      <td className="py-2.5">{line.volume} {line.uom === 'm3' ? 'm³' : 't'}</td>
                      <td className="py-2.5">{formatCurrency(line.base_price)}</td>
                      <td className="py-2.5">{line.freight > 0 ? formatCurrency(line.freight) : 'Pickup'}</td>
                      <td className="py-2.5 font-medium">{formatCurrency(line.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Blend */}
          {quote.blend && (
            <div className="bg-white border border-brand-stone p-4">
              <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide mb-3">
                Blend — <Badge variant={quote.blend.classification === 'complex' ? 'yellow' : 'green'}>{quote.blend.classification}</Badge>
              </h2>
              <div className="text-sm flex gap-6 mb-3">
                <Field label="Base tonnes">{quote.blend.total_base_tonnes.toFixed(3)}</Field>
                <Field label="Amendment tonnes">{quote.blend.total_amendment_tonnes.toFixed(3)}</Field>
                <Field label="Blend fee">{formatCurrency(quote.blend.blend_fee_rate)}/t</Field>
                <Field label="Blend fee total">{formatCurrency(quote.blend.blend_fee_total)}</Field>
              </div>
              {(quote.blend.amendments ?? []).length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-stone">
                      {['Amendment', 'Qty (t)', 'Rate', 'Total'].map((h) => (
                        <th key={h} className="text-left pb-2 text-xs font-medium text-brand-brown/50 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-stone/30">
                    {(quote.blend.amendments ?? []).map((a) => (
                      <tr key={a.id}>
                        <td className="py-2.5">{(a.amendment as any)?.name ?? a.custom_name ?? '—'}</td>
                        <td className="py-2.5">{a.quantity_tonnes.toFixed(3)}</td>
                        <td className="py-2.5">{formatCurrency(a.rate_per_tonne)}/t</td>
                        <td className="py-2.5 font-medium">{formatCurrency(a.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Notes */}
          {quote.notes && (
            <div className="bg-white border border-brand-stone p-4">
              <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide mb-2">Notes</h2>
              <p className="text-sm text-brand-brown">{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Pricing summary */}
          <div className="bg-white border border-brand-stone p-4">
            <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide mb-3">Summary</h2>
            <div className="flex flex-col gap-2 text-sm">
              <Row label="Product subtotal">{formatCurrency(productSubtotal)}</Row>
              {blendTotal > 0 && <Row label="Blend subtotal">{formatCurrency(blendTotal)}</Row>}
              <Row label="Subtotal">{formatCurrency(subtotal)}</Row>
              {quote.gst_type === 'ex' && <Row label="GST (10%)">{formatCurrency(gstAmount)}</Row>}
              <div className="border-t border-brand-stone pt-2 flex justify-between text-brand-green font-medium">
                <span>Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
              {quote.override_total != null && (
                <div className="border-t border-brand-stone pt-2 flex justify-between text-yellow-700">
                  <span>Override total</span>
                  <span className="font-medium">{formatCurrency(quote.override_total)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status management */}
          <div className="bg-white border border-brand-stone p-4">
            <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide mb-3">Status</h2>
            <div className="flex flex-col gap-2">
              {(['draft', 'sent', 'accepted', 'rejected'] as QuoteStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  disabled={status === s || updating}
                  className={`text-left px-3 py-2 text-sm capitalize transition-colors ${
                    status === s
                      ? 'bg-brand-stone text-brand-brown font-medium'
                      : 'hover:bg-brand-stone-light text-brand-brown/60'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Override log */}
          {overrideLogs.length > 0 && (
            <div className="bg-white border border-brand-stone p-4">
              <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide mb-3">Override History</h2>
              <div className="flex flex-col gap-3">
                {overrideLogs.map((log) => (
                  <div key={log.id} className="text-xs flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span className="text-brand-brown/50">{format(new Date(log.created_at), 'dd MMM yyyy')}</span>
                      <StatusBadge status={log.status} />
                    </div>
                    <div className="text-brand-brown">
                      {formatCurrency(log.original_total)} → {formatCurrency(log.override_total)}
                      <span className={`ml-2 ${log.variance_pct < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ({log.variance_pct > 0 ? '+' : ''}{log.variance_pct.toFixed(1)}%)
                      </span>
                    </div>
                    {log.notes && <p className="text-brand-brown/50">{log.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div>
      <dt className="text-xs text-brand-brown/50 uppercase tracking-wide">{label}</dt>
      <dd className={`mt-0.5 ${className ?? ''}`}>{children || '—'}</dd>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-brand-brown">
      <span className="text-brand-brown/70">{label}</span>
      <span>{children}</span>
    </div>
  )
}

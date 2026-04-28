'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DocumentArrowDownIcon, EnvelopeIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'
import { useQuoteBuilder } from '@/store/quoteBuilder'
import { createClient } from '@/lib/supabase/client'
import { classifyBlend, calcBlendFee, calcGST } from '@/lib/pricing'
import type { Product, PricingRule } from '@/lib/types'

interface QuoteActionsProps {
  products: Product[]
  pricingRules: PricingRule[]
  existingQuoteId?: string
}

export function QuoteActions({ products, pricingRules, existingQuoteId }: QuoteActionsProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(existingQuoteId ?? null)
  const [error, setError] = useState<string | null>(null)

  const store = useQuoteBuilder()

  async function saveQuote(status: 'draft' | 'sent' = 'draft'): Promise<string | null> {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const linesList = Array.from(store.lines.values())
      const amendmentsList = Array.from(store.blendAmendments.values())

      const productSubtotal = linesList.reduce((s, l) => s + l.lineTotal, 0)
      let blendFeeTotal = 0
      let blendClassification: 'simple' | 'complex' | null = null

      if (store.blendOpen && amendmentsList.length > 0) {
        const cls = classifyBlend(amendmentsList, false)
        blendClassification = cls
        const totalBaseTonnes = linesList.reduce((s, l) => s + l.volumeT, 0)
        const totalAmendmentTonnes = amendmentsList.reduce((s, a) => s + a.quantityT, 0)
        const { feeTotal } = calcBlendFee(cls, totalBaseTonnes + totalAmendmentTonnes)
        blendFeeTotal = feeTotal + amendmentsList.reduce((s, a) => s + a.lineTotal, 0)
      }

      const subtotal = productSubtotal + blendFeeTotal
      const gstAmount = calcGST(subtotal, store.gstType)
      const grandTotal = subtotal + gstAmount

      const quotePayload = {
        customer_name: store.customerName,
        contact_name: store.contactName || null,
        email: store.email || null,
        region_id: store.regionId || null,
        customer_type: store.customerType,
        fulfilment_type: store.fulfilmentType,
        gst_type: store.gstType,
        status,
        created_by: user.id,
        hubspot_deal_id: store.hubspotDealId || null,
        override_total: store.overrideEnabled && store.overrideTotal != null ? store.overrideTotal : null,
        notes: store.notes || null,
      }

      let quoteId = savedQuoteId
      if (quoteId) {
        await supabase.from('quotes').update(quotePayload).eq('id', quoteId)
        await supabase.from('quote_lines').delete().eq('quote_id', quoteId)
        await supabase.from('quote_blends').delete().eq('quote_id', quoteId)
      } else {
        const { data, error: insertErr } = await supabase
          .from('quotes')
          .insert({ ...quotePayload, quote_number: '' })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        quoteId = data.id
        setSavedQuoteId(quoteId)
      }

      // Insert lines
      if (linesList.length > 0) {
        await supabase.from('quote_lines').insert(
          linesList.map((l, idx) => ({
            quote_id: quoteId,
            product_id: l.productId,
            volume: l.volume,
            uom: l.uom,
            volume_t: l.volumeT,
            base_price: l.basePrice,
            freight: l.freight,
            line_total: l.lineTotal,
            sort_order: idx,
          }))
        )
      }

      // Insert blend
      if (store.blendOpen && blendClassification && amendmentsList.length > 0) {
        const totalBaseTonnes = linesList.reduce((s, l) => s + l.volumeT, 0)
        const totalAmendmentTonnes = amendmentsList.reduce((s, a) => s + a.quantityT, 0)
        const { feeRate, feeTotal } = calcBlendFee(blendClassification, totalBaseTonnes + totalAmendmentTonnes)

        const { data: blendData } = await supabase.from('quote_blends').insert({
          quote_id: quoteId,
          classification: blendClassification,
          total_base_tonnes: totalBaseTonnes,
          total_amendment_tonnes: totalAmendmentTonnes,
          blend_fee_rate: feeRate,
          blend_fee_total: feeTotal,
        }).select('id').single()

        if (blendData) {
          await supabase.from('blend_amendments').insert(
            amendmentsList.map((a, idx) => ({
              quote_blend_id: blendData.id,
              amendment_id: a.amendmentId || null,
              custom_name: a.customName || null,
              quantity_tonnes: a.quantityT,
              rate_per_tonne: a.ratePerTonne,
              line_total: a.lineTotal,
              sort_order: idx,
            }))
          )
        }
      }

      // Log override if applicable
      if (store.overrideEnabled && store.overrideTotal != null) {
        const variancePct = ((store.overrideTotal - grandTotal) / grandTotal) * 100
        await supabase.from('override_log').insert({
          quote_id: quoteId,
          original_total: grandTotal,
          override_total: store.overrideTotal,
          variance_pct: variancePct,
          requested_by: user.id,
        })
      }

      return quoteId
    } catch (err: any) {
      setError(err.message ?? 'Failed to save quote')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateQuote() {
    const id = await saveQuote('draft')
    if (id) router.push(`/quotes/${id}`)
  }

  async function handlePreviewPDF() {
    const id = savedQuoteId ?? (await saveQuote())
    if (id) window.open(`/api/quotes/${id}/pdf?view=customer`, '_blank')
  }

  async function handleEmailCustomer() {
    const id = savedQuoteId ?? (await saveQuote('sent'))
    if (!id) return
    setEmailSending(true)
    try {
      const res = await fetch(`/api/quotes/${id}/email`, { method: 'POST' })
      if (!res.ok) throw new Error('Email failed')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setEmailSending(false)
    }
  }

  async function handleHubSpotSync() {
    const id = savedQuoteId ?? (await saveQuote())
    if (!id) return
    setSyncing(true)
    try {
      const res = await fetch('/api/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: id }),
      })
      if (!res.ok) throw new Error('HubSpot sync failed')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleGenerateQuote} loading={saving} size="lg">
          Generate Quote
        </Button>
        <Button variant="secondary" onClick={handlePreviewPDF} disabled={saving}>
          <DocumentArrowDownIcon className="w-4 h-4" />
          Preview PDF
        </Button>
        <Button variant="secondary" onClick={handleEmailCustomer} loading={emailSending}>
          <EnvelopeIcon className="w-4 h-4" />
          Email Customer
        </Button>
        <Button variant="ghost" onClick={handleHubSpotSync} loading={syncing}>
          <ArrowPathIcon className="w-4 h-4" />
          Push to HubSpot
        </Button>
      </div>
    </div>
  )
}

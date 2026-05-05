'use client'

import { useState } from 'react'
import { useQuoteBuilder } from '@/store/quoteBuilder'
import { Input } from '@/components/ui/Input'
import type { Region } from '@/lib/types'

interface CustomerFieldsProps {
  regions: Region[]
}

export function CustomerFields({ regions }: CustomerFieldsProps) {
  const quoteName = useQuoteBuilder((s) => s.quoteName)
  const customerName = useQuoteBuilder((s) => s.customerName)
  const contactName = useQuoteBuilder((s) => s.contactName)
  const email = useQuoteBuilder((s) => s.email)
  const hubspotDealId = useQuoteBuilder((s) => s.hubspotDealId)
  const regionId = useQuoteBuilder((s) => s.regionId)
  const setCustomerField = useQuoteBuilder((s) => s.setCustomerField)
  const setRegionId = useQuoteBuilder((s) => s.setRegionId)
  const setAllLinesUom = useQuoteBuilder((s) => s.setAllLinesUom)

  const [prefilling, setPrefilling] = useState(false)
  const [prefillStatus, setPrefillStatus] = useState<'idle' | 'success' | 'error'>('idle')

  function handleRegionChange(id: string) {
    const selected = regions.find((r) => r.id === id)
    setRegionId(id, selected?.default_uom)
    if (selected) setAllLinesUom(selected.default_uom)
  }

  async function handleDealIdBlur(e: React.FocusEvent<HTMLInputElement>) {
    const val = e.target.value.trim()
    if (!val) return
    setPrefilling(true)
    setPrefillStatus('idle')
    try {
      const res = await fetch(`/api/hubspot/deal?dealId=${encodeURIComponent(val)}`)
      if (!res.ok) throw new Error('Deal not found')
      const data = await res.json()
      if (!customerName && data.company) setCustomerField('customerName', data.company)
      if (!contactName && data.contactName) setCustomerField('contactName', data.contactName)
      if (!email && data.email) setCustomerField('email', data.email)
      if (!quoteName && data.quoteName) setCustomerField('quoteName', data.quoteName)
      setPrefillStatus('success')
    } catch {
      setPrefillStatus('error')
    } finally {
      setPrefilling(false)
    }
  }

  return (
    <div className="bg-white border border-brand-stone p-4">
      <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide mb-4">Customer Details</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2 lg:col-span-3">
          <Input
            label="Quote Name / Project Reference"
            value={quoteName}
            onChange={(e) => setCustomerField('quoteName', e.target.value)}
            placeholder="e.g. Autumn soil prep — Eastern block"
            maxLength={120}
          />
        </div>
        <Input
          label="Company Name"
          value={customerName}
          onChange={(e) => setCustomerField('customerName', e.target.value)}
          placeholder="e.g. ABC Nursery Pty Ltd"
        />
        <Input
          label="Contact Name"
          value={contactName}
          onChange={(e) => setCustomerField('contactName', e.target.value)}
          placeholder="e.g. Jane Smith"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setCustomerField('email', e.target.value)}
          placeholder="jane@example.com"
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">
            Region
          </label>
          <select
            value={regionId}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="border border-brand-stone bg-white px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green"
          >
            <option value="">— Select region —</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.default_uom === 't' ? 'Tonnes' : 'm³ default'})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">
            HubSpot Deal ID
          </label>
          <input
            type="text"
            defaultValue={hubspotDealId}
            onChange={(e) => setCustomerField('hubspotDealId', e.target.value)}
            onBlur={handleDealIdBlur}
            placeholder="Paste deal ID to auto-fill"
            className="border border-brand-stone bg-white px-3 py-2 text-sm text-brand-brown w-full focus:outline-none focus:border-brand-green"
          />
          {prefilling && (
            <span className="text-xs text-brand-brown/50">Fetching from HubSpot...</span>
          )}
          {prefillStatus === 'success' && !prefilling && (
            <span className="text-xs text-brand-green">✓ Customer details pre-filled from HubSpot</span>
          )}
          {prefillStatus === 'error' && !prefilling && (
            <span className="text-xs text-red-500">Deal not found — check the ID and try again</span>
          )}
        </div>
      </div>
    </div>
  )
}

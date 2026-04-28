'use client'

import { useQuoteBuilder } from '@/store/quoteBuilder'
import type { CustomerType, FulfilmentType, GstType } from '@/lib/types'

export function QuoteSettingsBar() {
  const customerType = useQuoteBuilder((s) => s.customerType)
  const fulfilmentType = useQuoteBuilder((s) => s.fulfilmentType)
  const gstType = useQuoteBuilder((s) => s.gstType)
  const setCustomerType = useQuoteBuilder((s) => s.setCustomerType)
  const setFulfilmentType = useQuoteBuilder((s) => s.setFulfilmentType)
  const setGstType = useQuoteBuilder((s) => s.setGstType)

  return (
    <div className="bg-brand-brown text-white px-4 py-2 flex items-center gap-6 text-sm flex-wrap">
      <ToggleGroup
        label="Customer"
        options={[
          { value: 'distributor', label: 'Distributor' },
          { value: 'customer', label: 'Customer' },
        ]}
        value={customerType}
        onChange={(v) => setCustomerType(v as CustomerType)}
      />
      <ToggleGroup
        label="Fulfilment"
        options={[
          { value: 'delivery', label: 'Delivery' },
          { value: 'pickup', label: 'Pickup' },
        ]}
        value={fulfilmentType}
        onChange={(v) => setFulfilmentType(v as FulfilmentType)}
      />
      <ToggleGroup
        label="GST"
        options={[
          { value: 'ex', label: 'Ex GST' },
          { value: 'inc', label: 'Inc GST' },
        ]}
        value={gstType}
        onChange={(v) => setGstType(v as GstType)}
      />
    </div>
  )
}

function ToggleGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/50 text-xs uppercase tracking-wide">{label}</span>
      <div className="flex border border-white/20">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              value === opt.value
                ? 'bg-brand-green text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

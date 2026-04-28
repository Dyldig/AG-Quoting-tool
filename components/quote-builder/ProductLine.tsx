'use client'

import { useEffect, useRef, useCallback } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import { useQuoteBuilder } from '@/store/quoteBuilder'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, calcVolumeTonnes, calcTier, lookupBasePrice, lookupFreight, calcLineTotal } from '@/lib/pricing'
import type { Product, PricingRule, FreightMatrix, Region, UOM } from '@/lib/types'

interface ProductLineProps {
  lineId: string
  products: Product[]
  pricingRules: PricingRule[]
  freightMatrix: FreightMatrix[]
  regions: Region[]
}

export function ProductLine({ lineId, products, pricingRules, freightMatrix, regions }: ProductLineProps) {
  const line = useQuoteBuilder((s) => s.lines.get(lineId))
  const customerType = useQuoteBuilder((s) => s.customerType)
  const fulfilmentType = useQuoteBuilder((s) => s.fulfilmentType)
  const regionId = useQuoteBuilder((s) => s.regionId)
  const updateLine = useQuoteBuilder((s) => s.updateLine)
  const removeLine = useQuoteBuilder((s) => s.removeLine)

  // Stable refs for uncontrolled number input
  const volumeRef = useRef<HTMLInputElement>(null)
  const volumeValueRef = useRef<number>(line?.volume ?? 0)

  // Recalc whenever pricing inputs change — but NOT when the user is typing volume
  const recalc = useCallback(
    (vol?: number, u?: UOM, pid?: string) => {
      if (!line) return
      const volume = vol ?? volumeValueRef.current
      const uom = u ?? line.uom
      const productId = pid ?? line.productId

      const product = products.find((p) => p.id === productId)
      if (!product) return

      const volT = calcVolumeTonnes(volume, uom, product)
      const tier = calcTier(volT)
      const basePrice = lookupBasePrice(pricingRules, productId, customerType, tier) ?? 0
      const region = regions.find((r) => r.id === regionId)
      const freight = lookupFreight(freightMatrix, regionId, product.category, fulfilmentType)
      const lineTotal = calcLineTotal(volume, basePrice, freight)

      updateLine(lineId, {
        volume,
        uom,
        productId,
        volumeT: volT,
        tier,
        basePrice,
        freight,
        lineTotal,
      })
    },
    [line, products, pricingRules, freightMatrix, regions, customerType, fulfilmentType, regionId, lineId, updateLine]
  )

  // Bind focus/blur once — select-all on focus, sync value on blur
  useEffect(() => {
    const el = volumeRef.current
    if (!el) return

    function onFocus() {
      el!.select()
    }
    function onBlur() {
      const parsed = parseFloat(el!.value) || 0
      volumeValueRef.current = parsed
      recalc(parsed)
    }
    function onInput() {
      const parsed = parseFloat(el!.value) || 0
      volumeValueRef.current = parsed
    }

    el.addEventListener('focus', onFocus)
    el.addEventListener('blur', onBlur)
    el.addEventListener('input', onInput)
    return () => {
      el.removeEventListener('focus', onFocus)
      el.removeEventListener('blur', onBlur)
      el.removeEventListener('input', onInput)
    }
  }, [recalc])

  // Re-run pricing when external factors change (not volume)
  useEffect(() => {
    recalc()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerType, fulfilmentType, regionId])

  if (!line) return null

  const product = products.find((p) => p.id === line.productId)

  return (
    <div className="bg-white border border-brand-stone p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">Product</label>
          <select
            value={line.productId}
            onChange={(e) => recalc(undefined, undefined, e.target.value)}
            className="mt-1 border border-brand-stone bg-white px-3 py-2 text-sm text-brand-brown w-full focus:outline-none focus:border-brand-green"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>

        <div className="w-40">
          <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">Volume</label>
          <div className="mt-1 flex border border-brand-stone">
            <input
              ref={volumeRef}
              type="number"
              defaultValue={line.volume || ''}
              placeholder="0"
              className="flex-1 px-3 py-2 text-sm text-brand-brown bg-white focus:outline-none min-w-0"
            />
            <select
              value={line.uom}
              onChange={(e) => recalc(undefined, e.target.value as UOM)}
              className="border-l border-brand-stone bg-white px-2 py-2 text-sm text-brand-brown focus:outline-none"
            >
              <option value="m3">m³</option>
              <option value="t">t</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => removeLine(lineId)}
          className="mt-6 p-2 text-brand-brown/40 hover:text-red-500 transition-colors"
          title="Remove line"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap gap-4 text-sm border-t border-brand-stone/40 pt-3">
        <MetaCell label="Tier">
          <Badge variant={line.tier === 'bulk' ? 'green' : 'stone'}>{line.tier === 'bulk' ? 'Bulk' : 'Standard'}</Badge>
        </MetaCell>
        <MetaCell label="Tonnes">{formatNumber(line.volumeT)}</MetaCell>
        <MetaCell label="Base Price">{formatCurrency(line.basePrice)}/{line.uom === 'm3' ? 'm³' : 't'}</MetaCell>
        <MetaCell label="Freight">{line.freight > 0 ? formatCurrency(line.freight) : 'Pickup'}</MetaCell>
        <MetaCell label="Line Total" highlight>
          {formatCurrency(line.lineTotal)}
        </MetaCell>
      </div>
    </div>
  )
}

function MetaCell({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-brand-brown/50 uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-brand-green' : 'text-brand-brown'}`}>{children}</span>
    </div>
  )
}

function formatNumber(v: number) {
  return v.toFixed(3)
}

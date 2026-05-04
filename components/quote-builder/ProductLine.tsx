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
  regions?: Region[]
}

export function ProductLine({ lineId, products, pricingRules, freightMatrix }: ProductLineProps) {
  const line = useQuoteBuilder((s) => s.lines.get(lineId))
  const customerType = useQuoteBuilder((s) => s.customerType)
  const fulfilmentType = useQuoteBuilder((s) => s.fulfilmentType)
  const regionId = useQuoteBuilder((s) => s.regionId)
  const blendOpen = useQuoteBuilder((s) => s.blendOpen)
  const updateLine = useQuoteBuilder((s) => s.updateLine)
  const removeLine = useQuoteBuilder((s) => s.removeLine)

  const volumeRef = useRef<HTMLInputElement>(null)
  const freightRef = useRef<HTMLInputElement>(null)
  const volumeValueRef = useRef<number>(line?.volume ?? 0)
  const freightOverrideValueRef = useRef<number>(line?.freightOverride ?? 0)

  const recalcRef = useRef<(vol?: number, u?: UOM, pid?: string, freightOvr?: number) => void>(() => {})

  const recalc = useCallback(
    (vol?: number, u?: UOM, pid?: string, freightOvr?: number) => {
      if (!line) return
      const volume = vol ?? volumeValueRef.current
      const productId = pid ?? line.productId

      const product = products.find((p) => p.id === productId)
      if (!product) return

      const uom: UOM = product.category === 'pellets' ? 't' : (u ?? line.uom)
      const volT = calcVolumeTonnes(volume, uom, product)
      const tier = calcTier(volT)
      const basePrice = lookupBasePrice(pricingRules, productId, customerType, tier) ?? 0
      const freight = lookupFreight(freightMatrix, regionId, product.category, fulfilmentType)
      const freightOverride = freightOvr ?? freightOverrideValueRef.current

      let lineTotal: number
      if (product.category === 'pellets') {
        lineTotal = volume * (basePrice + freightOverride)
      } else if (blendOpen) {
        // freight handled cumulatively in blend section
        lineTotal = volume * basePrice
      } else {
        lineTotal = calcLineTotal(volume, basePrice, freight)
      }

      updateLine(lineId, {
        volume, uom, productId,
        productCategory: product.category,
        volumeT: volT, tier, basePrice, freight,
        freightOverride, lineTotal,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [line, products, pricingRules, freightMatrix, customerType, fulfilmentType, regionId, lineId, updateLine, blendOpen]
  )

  useEffect(() => { recalcRef.current = recalc })

  // Bind volume input listeners once
  useEffect(() => {
    const el = volumeRef.current
    if (!el) return
    const onFocus = () => el.select()
    const onInput = () => { volumeValueRef.current = parseFloat(el.value) || 0 }
    const onBlur = () => {
      const parsed = parseFloat(el.value) || 0
      volumeValueRef.current = parsed
      recalcRef.current(parsed)
    }
    el.addEventListener('focus', onFocus)
    el.addEventListener('input', onInput)
    el.addEventListener('blur', onBlur)
    return () => {
      el.removeEventListener('focus', onFocus)
      el.removeEventListener('input', onInput)
      el.removeEventListener('blur', onBlur)
    }
  }, [])

  // Bind freight override input (pellets only) — re-bind when product changes
  useEffect(() => {
    const el = freightRef.current
    if (!el) return
    const onFocus = () => el.select()
    const onInput = () => { freightOverrideValueRef.current = parseFloat(el.value) || 0 }
    const onBlur = () => {
      const parsed = parseFloat(el.value) || 0
      freightOverrideValueRef.current = parsed
      recalcRef.current(undefined, undefined, undefined, parsed)
    }
    el.addEventListener('focus', onFocus)
    el.addEventListener('input', onInput)
    el.addEventListener('blur', onBlur)
    return () => {
      el.removeEventListener('focus', onFocus)
      el.removeEventListener('input', onInput)
      el.removeEventListener('blur', onBlur)
    }
  }, [line?.productId])

  // Re-run pricing when external factors change
  useEffect(() => {
    recalcRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerType, fulfilmentType, regionId, blendOpen])

  // Detect external UOM change (e.g. from region auto-set) and trigger recalc
  const prevUomRef = useRef<UOM | null>(null)
  useEffect(() => {
    const currentUom = line?.uom ?? null
    if (currentUom !== null && prevUomRef.current !== null && currentUom !== prevUomRef.current) {
      recalcRef.current(undefined, currentUom)
    }
    prevUomRef.current = currentUom
  }, [line?.uom])

  if (!line) return null

  const currentProduct = products.find((p) => p.id === line.productId)
  const isPellet = currentProduct?.category === 'pellets'

  function handleProductChange(newProductId: string) {
    freightOverrideValueRef.current = 0
    if (freightRef.current) freightRef.current.value = ''
    recalcRef.current(undefined, undefined, newProductId, 0)
  }

  return (
    <div className="bg-white border border-brand-stone p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">Product</label>
          <select
            value={line.productId}
            onChange={(e) => handleProductChange(e.target.value)}
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
            {isPellet ? (
              <span className="border-l border-brand-stone bg-brand-stone-light px-3 py-2 text-sm text-brand-brown/60 select-none">
                t
              </span>
            ) : (
              <select
                value={line.uom}
                onChange={(e) => recalcRef.current(undefined, e.target.value as UOM)}
                className="border-l border-brand-stone bg-white px-2 py-2 text-sm text-brand-brown focus:outline-none"
              >
                <option value="m3">m³</option>
                <option value="t">t</option>
              </select>
            )}
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

      {/* Pellet freight rate input */}
      {isPellet && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-brand-brown uppercase tracking-wide shrink-0">
            Freight rate ($/t)
          </label>
          <input
            ref={freightRef}
            type="number"
            defaultValue={line.freightOverride || ''}
            placeholder="Ex gate ($0)"
            className="border border-brand-stone px-3 py-1.5 text-sm text-brand-brown bg-white focus:outline-none focus:border-brand-green w-40"
          />
          {line.freightOverride === 0 && (
            <span className="text-xs text-brand-brown/50">Ex gate</span>
          )}
        </div>
      )}

      {/* Meta strip */}
      <div className="flex flex-wrap gap-4 text-sm border-t border-brand-stone/40 pt-3">
        <MetaCell label="Tier">
          <Badge variant={line.tier === 'bulk' ? 'green' : 'stone'}>
            {line.tier === 'bulk' ? 'Bulk' : 'Standard'}
          </Badge>
        </MetaCell>
        <MetaCell label="Tonnes">{line.volumeT.toFixed(3)}</MetaCell>
        <MetaCell label="Base Price">{formatCurrency(line.basePrice)}/{line.uom === 'm3' ? 'm³' : 't'}</MetaCell>
        <MetaCell label="Freight">
          {isPellet
            ? (line.freightOverride > 0 ? formatCurrency(line.freightOverride) : 'Ex gate')
            : blendOpen
              ? <span className="text-brand-brown/40">Blend</span>
              : line.freight > 0 ? formatCurrency(line.freight) : 'Pickup'}
        </MetaCell>
        <MetaCell label="Line Total" highlight>{formatCurrency(line.lineTotal)}</MetaCell>
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

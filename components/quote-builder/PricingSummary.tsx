'use client'

import { useQuoteBuilder } from '@/store/quoteBuilder'
import { classifyBlend, calcBlendFee, calcGST, formatCurrency, lookupBasePrice } from '@/lib/pricing'
import type { Product, PricingRule } from '@/lib/types'

interface PricingSummaryProps {
  products: Product[]
  pricingRules: PricingRule[]
}

export function PricingSummary({ products, pricingRules }: PricingSummaryProps) {
  const lines = useQuoteBuilder((s) => s.lines)
  const blendAmendments = useQuoteBuilder((s) => s.blendAmendments)
  const blendOpen = useQuoteBuilder((s) => s.blendOpen)
  const gstType = useQuoteBuilder((s) => s.gstType)
  const customerType = useQuoteBuilder((s) => s.customerType)
  const fulfilmentType = useQuoteBuilder((s) => s.fulfilmentType)
  const overrideEnabled = useQuoteBuilder((s) => s.overrideEnabled)
  const overrideTotal = useQuoteBuilder((s) => s.overrideTotal)
  const setOverrideEnabled = useQuoteBuilder((s) => s.setOverrideEnabled)
  const setOverrideTotal = useQuoteBuilder((s) => s.setOverrideTotal)

  const linesList = Array.from(lines.values())
  const amendmentsList = Array.from(blendAmendments.values())

  const productSubtotal = linesList.reduce((sum, l) => sum + l.lineTotal, 0)

  let blendFeeTotal = 0
  let blendClassification: 'simple' | 'complex' | null = null
  if (blendOpen && amendmentsList.length > 0) {
    const classification = classifyBlend(amendmentsList, false)
    blendClassification = classification
    const totalBaseTonnes = linesList.reduce((sum, l) => sum + l.volumeT, 0)
    const totalAmendmentTonnes = amendmentsList.reduce((sum, a) => sum + a.quantityT, 0)
    const { feeTotal } = calcBlendFee(classification, totalBaseTonnes + totalAmendmentTonnes)
    blendFeeTotal = feeTotal + amendmentsList.reduce((sum, a) => sum + a.lineTotal, 0)
  }

  // Cumulative blend freight (when blend is open and delivery)
  const compostLine = blendOpen ? linesList.find(l => l.productCategory === 'compost') : null
  const compostFreightRate = blendOpen && fulfilmentType === 'delivery' ? (compostLine?.freight ?? 0) : 0
  const totalBaseTonnes = linesList.reduce((sum, l) => sum + l.volumeT, 0)
  const totalAmendmentTonnes = amendmentsList.reduce((sum, a) => sum + a.quantityT, 0)
  const blendFreightTotal = compostFreightRate * (totalBaseTonnes + totalAmendmentTonnes)

  const subtotal = productSubtotal + blendFeeTotal + blendFreightTotal
  const gstAmount = calcGST(subtotal, gstType)
  const grandTotal = subtotal + gstAmount

  const variancePct = overrideEnabled && overrideTotal != null
    ? ((overrideTotal - grandTotal) / grandTotal) * 100
    : 0

  return (
    <div className="bg-white border border-brand-stone">
      <div className="px-4 py-3 border-b border-brand-stone">
        <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide">Pricing Summary</h2>
      </div>

      <div className="p-4 flex flex-col gap-2">
        {/* Product lines */}
        {linesList.length === 0 ? (
          <p className="text-sm text-brand-brown/40">No products added.</p>
        ) : (
          linesList.map((line) => {
            const product = products.find((p) => p.id === line.productId)
            const isBlendCompost = blendOpen && line.productCategory === 'compost'
            const isPellet = line.productCategory === 'pellets'
            const pricingUom = (isBlendCompost || isPellet) ? 't' : line.uom
            const effectiveVolumeForRrp = isBlendCompost ? line.volumeT : line.volume
            const rrp = customerType === 'distributor'
              ? lookupBasePrice(pricingRules, line.productId, 'customer', line.tier, pricingUom)
              : null
            const rrpLineTotal = rrp != null ? effectiveVolumeForRrp * (rrp + (blendOpen ? 0 : line.freight)) : null

            return (
              <div key={line.id} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span className="text-brand-brown">{product?.name ?? 'Product'}</span>
                  <span className="font-medium">{formatCurrency(line.lineTotal)}</span>
                </div>
                <div className="text-xs text-brand-brown/50 flex gap-3">
                  {isBlendCompost && line.uom === 'm3' ? (
                    <span>{line.volumeT.toFixed(3)} t (from {line.volume} m³)</span>
                  ) : (
                    <span>{line.volume} {line.uom === 'm3' ? 'm³' : 't'}</span>
                  )}
                  <span>Base: {formatCurrency(line.basePrice)}/{pricingUom === 'm3' ? 'm³' : 't'}</span>
                  {isPellet ? (
                    <span>Freight: {line.freightOverride > 0 ? formatCurrency(line.freightOverride) : 'Ex gate'}</span>
                  ) : blendOpen ? (
                    <span className="text-brand-brown/30">Freight: blend</span>
                  ) : (
                    <span>Freight: {line.freight > 0 ? formatCurrency(line.freight) : 'Pickup'}</span>
                  )}
                  <span className="uppercase">{line.tier}</span>
                </div>
                {rrpLineTotal != null && (
                  <div className="text-xs text-brand-brown/50">
                    RRP comparison: {formatCurrency(rrpLineTotal)} (customer rate)
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Blend fee + amendments */}
        {blendOpen && blendClassification && (
          <div className="border-t border-brand-stone/40 pt-2 flex justify-between text-sm">
            <span className="text-brand-brown">Blend ({blendClassification})</span>
            <span className="font-medium">{formatCurrency(blendFeeTotal)}</span>
          </div>
        )}

        {/* Blend cumulative freight */}
        {blendOpen && compostFreightRate > 0 && (
          <div className="flex justify-between text-sm text-brand-brown/70">
            <span>Blend Freight ({(totalBaseTonnes + totalAmendmentTonnes).toFixed(2)} t × {formatCurrency(compostFreightRate)})</span>
            <span>{formatCurrency(blendFreightTotal)}</span>
          </div>
        )}

        {/* Subtotal */}
        <div className="border-t border-brand-stone pt-2 flex justify-between text-sm font-medium">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        {/* GST */}
        {gstType === 'ex' && (
          <div className="flex justify-between text-sm text-brand-brown/60">
            <span>GST (10%)</span>
            <span>{formatCurrency(gstAmount)}</span>
          </div>
        )}

        {/* Grand Total */}
        <div className="border-t border-brand-stone pt-2 flex justify-between text-base font-medium text-brand-green">
          <span>Total {gstType === 'ex' ? 'inc GST' : 'inc GST'}</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>

        {/* Override */}
        <div className="border-t border-brand-stone/40 pt-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-brand-brown cursor-pointer">
            <input
              type="checkbox"
              checked={overrideEnabled}
              onChange={(e) => setOverrideEnabled(e.target.checked)}
              className="accent-brand-green"
            />
            Manual price override
          </label>
          {overrideEnabled && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-brand-brown/50">$</span>
                <input
                  type="number"
                  value={overrideTotal ?? ''}
                  onChange={(e) => setOverrideTotal(parseFloat(e.target.value) || null)}
                  onFocus={(e) => e.target.select()}
                  placeholder={grandTotal.toFixed(2)}
                  className="border border-brand-stone px-3 py-1.5 text-sm text-brand-brown bg-white focus:outline-none focus:border-brand-green flex-1"
                />
              </div>
              {overrideTotal != null && (
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${variancePct < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {variancePct > 0 ? '+' : ''}{variancePct.toFixed(1)}% variance
                  </span>
                  <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5">Approval required</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

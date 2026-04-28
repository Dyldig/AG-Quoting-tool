'use client'

import { useState, useEffect } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { useQuoteBuilder } from '@/store/quoteBuilder'
import { QuoteSettingsBar } from '@/components/quote-builder/QuoteSettingsBar'
import { CustomerFields } from '@/components/quote-builder/CustomerFields'
import { ProductLine } from '@/components/quote-builder/ProductLine'
import { BlendSection } from '@/components/quote-builder/BlendSection'
import { PricingSummary } from '@/components/quote-builder/PricingSummary'
import { QuoteActions } from '@/components/quote-builder/QuoteActions'
import type { Product, PricingRule, FreightMatrix, Region, Amendment } from '@/lib/types'

interface QuoteBuilderClientProps {
  products: Product[]
  pricingRules: PricingRule[]
  freightMatrix: FreightMatrix[]
  regions: Region[]
  amendments: Amendment[]
}

export function QuoteBuilderClient({
  products,
  pricingRules,
  freightMatrix,
  regions,
  amendments,
}: QuoteBuilderClientProps) {
  const lines = useQuoteBuilder((s) => s.lines)
  const addLine = useQuoteBuilder((s) => s.addLine)
  const resetQuote = useQuoteBuilder((s) => s.resetQuote)

  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id ?? '')

  // Reset on mount
  useEffect(() => {
    resetQuote()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddProduct() {
    if (!selectedProduct) return
    addLine(selectedProduct)
  }

  return (
    <div className="flex flex-col">
      <QuoteSettingsBar />

      <div className="max-w-screen-xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium text-brand-brown">New Quote</h1>
        </div>

        {/* Customer details */}
        <CustomerFields regions={regions} />

        {/* Products */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide">Products</h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="border border-brand-stone bg-white px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddProduct}
                className="flex items-center gap-1.5 bg-brand-brown text-white px-3 py-2 text-sm font-medium hover:bg-brand-brown-light transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Product
              </button>
            </div>
          </div>

          {lines.size === 0 ? (
            <div className="bg-white border border-dashed border-brand-stone p-8 text-center text-sm text-brand-brown/40">
              Add a product to begin building your quote.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {Array.from(lines.keys()).map((lineId) => (
                <ProductLine
                  key={lineId}
                  lineId={lineId}
                  products={products}
                  pricingRules={pricingRules}
                  freightMatrix={freightMatrix}
                  regions={regions}
                />
              ))}
            </div>
          )}

          <BlendSection amendments={amendments} />
        </div>

        {/* Pricing summary */}
        <PricingSummary products={products} pricingRules={pricingRules} />

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">Notes</label>
          <NotesField />
        </div>

        {/* Actions */}
        <QuoteActions products={products} pricingRules={pricingRules} />
      </div>
    </div>
  )
}

function NotesField() {
  const notes = useQuoteBuilder((s) => s.notes)
  const setCustomerField = useQuoteBuilder((s) => s.setCustomerField)
  return (
    <textarea
      value={notes}
      onChange={(e) => setCustomerField('notes', e.target.value)}
      rows={3}
      placeholder="Internal notes for this quote..."
      className="border border-brand-stone bg-white px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green resize-none"
    />
  )
}

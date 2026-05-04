'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useQuoteBuilder } from '@/store/quoteBuilder'
import { QuoteSettingsBar } from '@/components/quote-builder/QuoteSettingsBar'
import { CustomerFields } from '@/components/quote-builder/CustomerFields'
import { ProductLine } from '@/components/quote-builder/ProductLine'
import { BlendSection } from '@/components/quote-builder/BlendSection'
import { PricingSummary } from '@/components/quote-builder/PricingSummary'
import { QuoteActions } from '@/components/quote-builder/QuoteActions'
import type { Product, PricingRule, FreightMatrix, Region, Amendment, UOM } from '@/lib/types'

const DISCLAIMER_SKUS = new Set(['SCORGCOM25', 'MUDURMUL', 'SCGRCHCOM'])

const DISCLAIMER_TEXT = `Please note that Jeffries Commercial Compost is a commercial product and may contain inorganic foreign material. While we do our best to minimise inorganics through innovative technologies, the nature of the product means it may not always meet the specific requirements for certain applications. Prior to order, you should assess whether this product is suitable for your intended purpose. For applications requiring a more refined product, we recommend Jeffries Organic Compost.`

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
  const regionId = useQuoteBuilder((s) => s.regionId)
  const disclaimerAcknowledged = useQuoteBuilder((s) => s.disclaimerAcknowledged)
  const setDisclaimerAcknowledged = useQuoteBuilder((s) => s.setDisclaimerAcknowledged)

  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id ?? '')

  // Reset on mount
  useEffect(() => {
    resetQuote()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Determine if any current product line requires a disclaimer
  const hasDisclaimerProduct = Array.from(lines.values()).some((line) => {
    const product = products.find((p) => p.id === line.productId)
    return product && DISCLAIMER_SKUS.has(product.sku)
  })

  function handleAddProduct() {
    if (!selectedProduct) return
    const product = products.find((p) => p.id === selectedProduct)
    // Pellets always use tonnes; other products inherit the region default
    const uom: UOM = product?.category === 'pellets'
      ? 't'
      : (regions.find((r) => r.id === regionId)?.default_uom ?? 'm3')
    addLine(selectedProduct, uom)
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

        {/* Disclaimer banner */}
        {hasDisclaimerProduct && (
          <div className="border border-amber-300 bg-amber-50 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900 mb-1">Product Disclaimer</p>
                <p className="text-sm text-amber-800 leading-relaxed">{DISCLAIMER_TEXT}</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer ml-8">
              <input
                type="checkbox"
                checked={disclaimerAcknowledged}
                onChange={(e) => setDisclaimerAcknowledged(e.target.checked)}
                className="w-4 h-4 accent-amber-700"
              />
              <span className="text-sm text-amber-900">
                I confirm the customer has been informed of and acknowledges this product disclaimer
              </span>
            </label>
          </div>
        )}

        {/* Pricing summary */}
        <PricingSummary products={products} pricingRules={pricingRules} />

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">Notes</label>
          <NotesField />
        </div>

        {/* Actions */}
        <QuoteActions disclaimerRequired={hasDisclaimerProduct} />
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

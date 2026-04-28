'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/pricing'
import { createClient } from '@/lib/supabase/client'
import type { Product, PricingRule, AdjustmentScope } from '@/lib/types'

interface PricingAdminClientProps {
  products: Product[]
  pricingRules: PricingRule[]
  adjustments: any[]
}

type EditingCell = { ruleId: string; field: 'price_per_unit' }

export function PricingAdminClient({ products, pricingRules: initialRules, adjustments }: PricingAdminClientProps) {
  const [rules, setRules] = useState(initialRules)
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [adjustScope, setAdjustScope] = useState<AdjustmentScope>('all')
  const [adjustPct, setAdjustPct] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [applying, setApplying] = useState(false)
  const [preview, setPreview] = useState<{ ruleId: string; newPrice: number }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Group rules: product → customer_type → volume_tier
  const activeProducts = products.filter((p) => p.active)

  function getRulePrice(productId: string, customerType: string, tier: string): PricingRule | undefined {
    return rules.find(
      (r) => r.product_id === productId && r.customer_type === customerType && r.volume_tier === tier
    )
  }

  async function saveEdit(rule: PricingRule, newPrice: number) {
    setSaving(true)
    const { error: err } = await supabase
      .from('pricing_rules')
      .update({ price_per_unit: newPrice, effective_date: new Date().toISOString().split('T')[0] })
      .eq('id', rule.id)
    if (err) {
      setError(err.message)
    } else {
      setRules((r) => r.map((x) => x.id === rule.id ? { ...x, price_per_unit: newPrice } : x))
    }
    setSaving(false)
    setEditing(null)
  }

  function calcPreview() {
    const pct = parseFloat(adjustPct) / 100
    if (isNaN(pct)) return
    const affected = rules.filter((r) => {
      if (adjustScope === 'all') return true
      const product = products.find((p) => p.id === r.product_id)
      return product?.category === adjustScope
    })
    setPreview(affected.map((r) => ({
      ruleId: r.id,
      newPrice: Math.round(r.price_per_unit * (1 + pct) * 100) / 100,
    })))
  }

  async function applyAdjustment() {
    if (!preview) return
    setApplying(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const today = new Date().toISOString().split('T')[0]

      // Insert new pricing rules with today's effective date
      const newRules = preview.map((p) => {
        const existing = rules.find((r) => r.id === p.ruleId)!
        return {
          product_id: existing.product_id,
          customer_type: existing.customer_type,
          volume_tier: existing.volume_tier,
          bulk_threshold_t: existing.bulk_threshold_t,
          price_per_unit: p.newPrice,
          effective_date: today,
        }
      })

      const { data: inserted } = await supabase.from('pricing_rules').upsert(newRules, {
        onConflict: 'product_id,customer_type,volume_tier,effective_date',
      }).select()

      await supabase.from('price_adjustments').insert({
        scope: adjustScope,
        adjustment_pct: parseFloat(adjustPct),
        applied_by: user?.id,
        notes: adjustNotes || null,
      })

      if (inserted) {
        setRules((r) => {
          const updated = [...r]
          inserted.forEach((ins: PricingRule) => {
            const idx = updated.findIndex(
              (x) => x.product_id === ins.product_id && x.customer_type === ins.customer_type && x.volume_tier === ins.volume_tier
            )
            if (idx >= 0) updated[idx] = ins
            else updated.push(ins)
          })
          return updated
        })
      }

      setPreview(null)
      setAdjustPct('')
      setAdjustNotes('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  const customerTypes = ['distributor', 'customer'] as const
  const tiers = ['standard', 'bulk'] as const

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 flex flex-col gap-6">
      <h1 className="text-lg font-medium text-brand-brown">Pricing Management</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      {/* Pricing table */}
      <div className="bg-white border border-brand-stone overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-stone bg-brand-stone-light">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-brand-brown uppercase tracking-wide">Product</th>
              {customerTypes.map((ct) =>
                tiers.map((tier) => (
                  <th key={`${ct}-${tier}`} className="text-right px-4 py-2.5 text-xs font-medium text-brand-brown uppercase tracking-wide">
                    {ct} / {tier}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-stone/40">
            {activeProducts.map((product) => (
              <tr key={product.id} className="hover:bg-brand-stone-light/40">
                <td className="px-4 py-3">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-brand-brown/50">{product.sku} · {product.category}</div>
                </td>
                {customerTypes.map((ct) =>
                  tiers.map((tier) => {
                    const rule = getRulePrice(product.id, ct, tier)
                    const isEditing = editing?.ruleId === rule?.id
                    const previewRow = preview?.find((p) => p.ruleId === rule?.id)

                    return (
                      <td key={`${ct}-${tier}`} className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && rule) saveEdit(rule, parseFloat(editValue))
                                if (e.key === 'Escape') setEditing(null)
                              }}
                              autoFocus
                              className="w-20 border border-brand-green px-2 py-1 text-right text-sm focus:outline-none"
                            />
                            <Button size="sm" onClick={() => rule && saveEdit(rule, parseFloat(editValue))} loading={saving}>✓</Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (rule) {
                                setEditing({ ruleId: rule.id, field: 'price_per_unit' })
                                setEditValue(rule.price_per_unit.toString())
                              }
                            }}
                            className="text-right hover:text-brand-green transition-colors"
                          >
                            <span className={previewRow ? 'line-through text-brand-brown/40' : ''}>
                              {rule ? formatCurrency(rule.price_per_unit) : '—'}
                            </span>
                            {previewRow && (
                              <span className="ml-1 text-brand-green font-medium">{formatCurrency(previewRow.newPrice)}</span>
                            )}
                          </button>
                        )}
                      </td>
                    )
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Global adjustment tool */}
      <div className="bg-white border border-brand-stone p-4 flex flex-col gap-4">
        <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide">Global % Adjustment</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">Scope</label>
            <select
              value={adjustScope}
              onChange={(e) => { setAdjustScope(e.target.value as AdjustmentScope); setPreview(null) }}
              className="border border-brand-stone px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green"
            >
              <option value="all">All products</option>
              <option value="compost">Compost only</option>
              <option value="mulch">Mulch only</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">Adjustment %</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={adjustPct}
                onChange={(e) => { setAdjustPct(e.target.value); setPreview(null) }}
                onFocus={(e) => e.target.select()}
                placeholder="e.g. 5 or -3"
                className="border border-brand-stone px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green w-28"
              />
              <span className="text-sm text-brand-brown/50">%</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label className="text-xs font-medium text-brand-brown uppercase tracking-wide">Notes</label>
            <input
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder="e.g. Annual price review 2026"
              className="border border-brand-stone px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green"
            />
          </div>
          <Button variant="secondary" onClick={calcPreview} disabled={!adjustPct}>
            Preview
          </Button>
          {preview && (
            <Button onClick={applyAdjustment} loading={applying}>
              Apply Adjustment
            </Button>
          )}
        </div>
        {preview && (
          <div className="text-sm text-brand-brown bg-brand-stone-light px-3 py-2">
            Preview: {preview.length} rules affected. Prices will be adjusted by {adjustPct}%.
          </div>
        )}
      </div>

      {/* Price history */}
      {adjustments.length > 0 && (
        <div className="bg-white border border-brand-stone">
          <div className="px-4 py-3 border-b border-brand-stone">
            <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide">Adjustment History</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-brand-stone bg-brand-stone-light">
              <tr>
                {['Date', 'Scope', 'Adjustment', 'Applied by', 'Notes'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-brand-brown uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-stone/40">
              {adjustments.map((adj) => (
                <tr key={adj.id}>
                  <td className="px-4 py-3 text-brand-brown/50">{format(new Date(adj.applied_at), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 capitalize">{adj.scope}</td>
                  <td className={`px-4 py-3 font-medium ${adj.adjustment_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {adj.adjustment_pct > 0 ? '+' : ''}{adj.adjustment_pct}%
                  </td>
                  <td className="px-4 py-3 text-brand-brown/50">{adj.profile?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-brand-brown/70">{adj.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

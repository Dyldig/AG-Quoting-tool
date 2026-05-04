'use client'

import { useRef, useEffect, useCallback } from 'react'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useQuoteBuilder } from '@/store/quoteBuilder'
import { Badge } from '@/components/ui/Badge'
import { classifyBlend, calcBlendFee, formatCurrency } from '@/lib/pricing'
import type { Amendment, AmendmentType } from '@/lib/types'

interface BlendSectionProps {
  amendments: Amendment[]
}

export function BlendSection({ amendments }: BlendSectionProps) {
  const blendOpen = useQuoteBuilder((s) => s.blendOpen)
  const toggleBlend = useQuoteBuilder((s) => s.toggleBlend)

  if (!blendOpen) {
    return (
      <button
        onClick={toggleBlend}
        className="flex items-center gap-2 text-sm text-brand-green hover:text-brand-green-dark font-medium transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        Add Blend
      </button>
    )
  }

  return (
    <div className="bg-white border border-brand-stone">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-stone">
        <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide">Blend Amendments</h2>
        <button onClick={toggleBlend} className="text-xs text-brand-brown/50 hover:text-brand-brown">
          Collapse
        </button>
      </div>
      <div className="p-4 flex flex-col gap-4">
        <BlendAmendmentList amendments={amendments} />
        <AddAmendmentControls amendments={amendments} />
        <BlendTotalsStrip />
      </div>
    </div>
  )
}

function BlendAmendmentList({ amendments }: { amendments: Amendment[] }) {
  const blendAmendments = useQuoteBuilder((s) => s.blendAmendments)

  if (blendAmendments.size === 0) {
    return <p className="text-sm text-brand-brown/50">No amendments added yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {Array.from(blendAmendments.values()).map((ba) => (
        <BlendAmendmentRow key={ba.id} id={ba.id} amendments={amendments} />
      ))}
    </div>
  )
}

function BlendAmendmentRow({ id, amendments }: { id: string; amendments: Amendment[] }) {
  const ba = useQuoteBuilder((s) => s.blendAmendments.get(id))
  const updateBlendAmendment = useQuoteBuilder((s) => s.updateBlendAmendment)
  const removeBlendAmendment = useQuoteBuilder((s) => s.removeBlendAmendment)

  const qtyRef = useRef<HTMLInputElement>(null)
  const rateRef = useRef<HTMLInputElement>(null)
  const qtyValueRef = useRef<number>(ba?.quantityT ?? 0)
  const rateValueRef = useRef<number>(ba?.ratePerTonne ?? 0)

  const recalc = useCallback(() => {
    const qty = qtyValueRef.current
    const rate = rateValueRef.current
    updateBlendAmendment(id, { quantityT: qty, ratePerTonne: rate, lineTotal: qty * rate })
  }, [id, updateBlendAmendment])

  // Bind input listeners once
  useEffect(() => {
    const qEl = qtyRef.current
    const rEl = rateRef.current
    if (!qEl || !rEl) return

    function bindInput(el: HTMLInputElement, ref: React.MutableRefObject<number>) {
      function onFocus() { el.select() }
      function onInput() { ref.current = parseFloat(el.value) || 0 }
      function onBlur() { ref.current = parseFloat(el.value) || 0; recalc() }
      el.addEventListener('focus', onFocus)
      el.addEventListener('input', onInput)
      el.addEventListener('blur', onBlur)
      return () => {
        el.removeEventListener('focus', onFocus)
        el.removeEventListener('input', onInput)
        el.removeEventListener('blur', onBlur)
      }
    }

    const c1 = bindInput(qEl, qtyValueRef)
    const c2 = bindInput(rEl, rateValueRef)
    return () => { c1?.(); c2?.() }
  }, [recalc])

  if (!ba) return null

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {ba.amendmentId ? (
        <span className="text-sm text-brand-brown font-medium w-40 shrink-0">
          {amendments.find((a) => a.id === ba.amendmentId)?.name ?? ba.customName}
        </span>
      ) : (
        <input
          value={ba.customName}
          onChange={(e) => updateBlendAmendment(id, { customName: e.target.value })}
          placeholder="Amendment name"
          className="border border-brand-stone px-2 py-1.5 text-sm text-brand-brown focus:outline-none focus:border-brand-green w-40"
        />
      )}

      <div className="flex items-center gap-1">
        <input
          ref={qtyRef}
          type="number"
          defaultValue={ba.quantityT || ''}
          placeholder="0"
          className="border border-brand-stone px-2 py-1.5 text-sm text-brand-brown bg-white focus:outline-none focus:border-brand-green w-24"
        />
        <span className="text-xs text-brand-brown/50">t</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-brand-brown/50">$</span>
        <input
          ref={rateRef}
          type="number"
          defaultValue={ba.ratePerTonne || ''}
          placeholder="0"
          className="border border-brand-stone px-2 py-1.5 text-sm text-brand-brown bg-white focus:outline-none focus:border-brand-green w-24"
        />
        <span className="text-xs text-brand-brown/50">/t</span>
      </div>

      <span className="text-sm font-medium text-brand-green w-24 text-right">
        {formatCurrency(ba.lineTotal)}
      </span>

      <button
        onClick={() => removeBlendAmendment(id)}
        className="p-1 text-brand-brown/40 hover:text-red-500 transition-colors"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

function AddAmendmentControls({ amendments }: { amendments: Amendment[] }) {
  const addBlendAmendment = useQuoteBuilder((s) => s.addBlendAmendment)

  const internalAmendments = amendments.filter((a) => a.is_internal && a.active)

  return (
    <div className="flex flex-wrap gap-2 border-t border-brand-stone/40 pt-3">
      <span className="text-xs text-brand-brown/50 uppercase tracking-wide w-full">Add amendment</span>
      {internalAmendments.map((a) => (
        <button
          key={a.id}
          onClick={() => addBlendAmendment(a.id, a.name, a.type as AmendmentType, a.price_per_tonne)}
          className="text-xs border border-brand-stone px-3 py-1.5 text-brand-brown hover:bg-brand-stone transition-colors"
        >
          + {a.name} ({formatCurrency(a.price_per_tonne)}/t)
        </button>
      ))}
      <button
        onClick={() => addBlendAmendment(null, '', 'bulk', 0)}
        className="text-xs border border-dashed border-brand-brown/30 px-3 py-1.5 text-brand-brown/60 hover:text-brand-brown hover:border-brand-brown transition-colors"
      >
        + Custom amendment
      </button>
    </div>
  )
}

function BlendTotalsStrip() {
  const blendAmendments = useQuoteBuilder((s) => s.blendAmendments)
  const lines = useQuoteBuilder((s) => s.lines)
  const fulfilmentType = useQuoteBuilder((s) => s.fulfilmentType)

  const linesList = Array.from(lines.values())
  const hasJOC = false // JOC detection deferred to page level

  const amendmentsList = Array.from(blendAmendments.values())
  const classification = classifyBlend(amendmentsList, hasJOC)
  const totalBaseTonnes = linesList.reduce((sum, l) => sum + l.volumeT, 0)
  const totalAmendmentTonnes = amendmentsList.reduce((sum, a) => sum + a.quantityT, 0)
  const totalBlendTonnes = totalBaseTonnes + totalAmendmentTonnes
  const { feeRate, feeTotal } = calcBlendFee(classification, totalBlendTonnes)
  const amendmentsCost = amendmentsList.reduce((sum, a) => sum + a.lineTotal, 0)

  // Cumulative freight: compost rate × total blend tonnes
  const compostLine = linesList.find(l => l.productCategory === 'compost')
  const compostFreightRate = fulfilmentType === 'delivery' ? (compostLine?.freight ?? 0) : 0
  const blendFreightTotal = compostFreightRate * totalBlendTonnes

  return (
    <div className="border-t border-brand-stone pt-3 flex flex-wrap gap-6 items-center">
      <div className="flex items-center gap-2">
        <span className="text-xs text-brand-brown/50 uppercase tracking-wide">Classification</span>
        <Badge variant={classification === 'complex' ? 'yellow' : 'green'}>
          {classification === 'complex' ? 'Complex' : 'Simple'}
        </Badge>
      </div>
      <MetaCell label="Base t">{totalBaseTonnes.toFixed(3)}</MetaCell>
      <MetaCell label="Amendment t">{totalAmendmentTonnes.toFixed(3)}</MetaCell>
      <MetaCell label="Blend Fee">{formatCurrency(feeRate)}/t × {totalBlendTonnes.toFixed(2)} t = {formatCurrency(feeTotal)}</MetaCell>
      <MetaCell label="Amendments Cost">{formatCurrency(amendmentsCost)}</MetaCell>
      {compostFreightRate > 0 && (
        <MetaCell label="Blend Freight">{formatCurrency(compostFreightRate)}/t × {totalBlendTonnes.toFixed(2)} t = {formatCurrency(blendFreightTotal)}</MetaCell>
      )}
      <MetaCell label="Blend Subtotal" highlight>
        {formatCurrency(feeTotal + amendmentsCost + blendFreightTotal)}
      </MetaCell>
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

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pricing'
import { createClient } from '@/lib/supabase/client'
import type { Region, FreightMatrix, Product } from '@/lib/types'

interface RegionsAdminClientProps {
  regions: Region[]
  freightMatrix: FreightMatrix[]
  products: Product[]
}

export function RegionsAdminClient({ regions: initialRegions, freightMatrix: initialMatrix }: RegionsAdminClientProps) {
  const [regions, setRegions] = useState(initialRegions)
  const [matrix, setMatrix] = useState(initialMatrix)
  const [addingRegion, setAddingRegion] = useState(false)
  const [newRegion, setNewRegion] = useState({ name: '', zone_group: '', default_uom: 'm3' as 'm3' | 't', subregion_description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function toggleActive(region: Region) {
    setSaving(true)
    const { error: err } = await supabase.from('regions').update({ active: !region.active }).eq('id', region.id)
    if (!err) setRegions((r) => r.map((x) => x.id === region.id ? { ...x, active: !x.active } : x))
    else setError(err.message)
    setSaving(false)
  }

  async function updateDefaultUom(region: Region, uom: 'm3' | 't') {
    const { error: err } = await supabase.from('regions').update({ default_uom: uom }).eq('id', region.id)
    if (!err) setRegions((r) => r.map((x) => x.id === region.id ? { ...x, default_uom: uom } : x))
    else setError(err.message)
  }

  async function addRegion() {
    setSaving(true)
    const { data, error: err } = await supabase.from('regions').insert(newRegion).select().single()
    if (err) setError(err.message)
    else if (data) { setRegions((r) => [...r, data as Region]); setAddingRegion(false); setNewRegion({ name: '', zone_group: '', default_uom: 'm3', subregion_description: '' }) }
    setSaving(false)
  }

  async function updateFreight(regionId: string, category: 'compost' | 'mulch', price: number) {
    const existing = matrix.find((m) => m.region_id === regionId && m.product_category === category)
    const today = new Date().toISOString().split('T')[0]
    if (existing) {
      await supabase.from('freight_matrix').update({ price_per_unit: price, effective_date: today }).eq('id', existing.id)
      setMatrix((m) => m.map((x) => x.id === existing.id ? { ...x, price_per_unit: price } : x))
    } else {
      const { data } = await supabase.from('freight_matrix').insert({ region_id: regionId, product_category: category, price_per_unit: price, effective_date: today }).select().single()
      if (data) setMatrix((m) => [...m, data as FreightMatrix])
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-brand-brown">Region Management</h1>
        <Button size="sm" onClick={() => setAddingRegion(true)}>Add Region</Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      {addingRegion && (
        <div className="bg-white border border-brand-stone p-4 flex flex-col gap-3">
          <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide">New Region</h2>
          <div className="grid grid-cols-2 gap-3">
            <input value={newRegion.name} onChange={(e) => setNewRegion((r) => ({ ...r, name: e.target.value }))} placeholder="Region name" className="border border-brand-stone px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green" />
            <input value={newRegion.zone_group} onChange={(e) => setNewRegion((r) => ({ ...r, zone_group: e.target.value }))} placeholder="Zone group" className="border border-brand-stone px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green" />
            <select value={newRegion.default_uom} onChange={(e) => setNewRegion((r) => ({ ...r, default_uom: e.target.value as 'm3' | 't' }))} className="border border-brand-stone px-3 py-2 text-sm text-brand-brown focus:outline-none">
              <option value="m3">m³ (default)</option>
              <option value="t">Tonnes (default)</option>
            </select>
            <input value={newRegion.subregion_description} onChange={(e) => setNewRegion((r) => ({ ...r, subregion_description: e.target.value }))} placeholder="Description (optional)" className="border border-brand-stone px-3 py-2 text-sm text-brand-brown focus:outline-none focus:border-brand-green" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addRegion} loading={saving}>Save Region</Button>
            <Button variant="ghost" size="sm" onClick={() => setAddingRegion(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-white border border-brand-stone overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-stone bg-brand-stone-light">
            <tr>
              {['Region', 'Zone', 'Default UOM', 'Compost Freight', 'Mulch Freight', 'Status', ''].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-brand-brown uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-stone/40">
            {regions.map((region) => {
              const compostFreight = matrix.find((m) => m.region_id === region.id && m.product_category === 'compost')
              const mulchFreight = matrix.find((m) => m.region_id === region.id && m.product_category === 'mulch')
              return (
                <tr key={region.id} className={!region.active ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{region.name}</div>
                    {region.subregion_description && <div className="text-xs text-brand-brown/50">{region.subregion_description}</div>}
                  </td>
                  <td className="px-4 py-3 text-brand-brown/70">{region.zone_group ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={region.default_uom}
                      onChange={(e) => updateDefaultUom(region, e.target.value as 'm3' | 't')}
                      className="border border-brand-stone px-2 py-1 text-xs text-brand-brown focus:outline-none"
                    >
                      <option value="m3">m³</option>
                      <option value="t">t</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <FreightCell
                      value={compostFreight?.price_per_unit ?? null}
                      onChange={(v) => updateFreight(region.id, 'compost', v)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <FreightCell
                      value={mulchFreight?.price_per_unit ?? null}
                      onChange={(v) => updateFreight(region.id, 'mulch', v)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={region.active ? 'green' : 'default'}>{region.active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(region)} className="text-xs text-brand-brown/50 hover:text-brand-brown">
                      {region.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FreightCell({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={() => { onChange(parseFloat(editVal) || 0); setEditing(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { onChange(parseFloat(editVal) || 0); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
          autoFocus
          className="w-20 border border-brand-green px-2 py-1 text-right text-xs focus:outline-none"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => { setEditing(true); setEditVal(value?.toString() ?? '0') }}
      className="hover:text-brand-green transition-colors text-sm"
    >
      {value != null ? formatCurrency(value) : '—'}
    </button>
  )
}

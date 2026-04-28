'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/pricing'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

interface OverridesAdminClientProps {
  overrides: any[]
  userRole: UserRole
  userId: string
}

export function OverridesAdminClient({ overrides: initialOverrides, userRole, userId }: OverridesAdminClientProps) {
  const [overrides, setOverrides] = useState(initialOverrides)
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canApprove = userRole === 'sales_manager' || userRole === 'admin'
  const supabase = createClient()

  async function resolveOverride(id: string, status: 'approved' | 'rejected') {
    if (!canApprove) return
    setProcessing(id)
    const { error: err } = await supabase
      .from('override_log')
      .update({
        status,
        approved_by: userId,
        resolved_at: new Date().toISOString(),
        notes: actionNotes[id] || null,
      })
      .eq('id', id)

    if (err) setError(err.message)
    else {
      setOverrides((o) => o.map((x) => x.id === id ? { ...x, status, approved_by: userId } : x))
    }
    setProcessing(null)
  }

  const pending = overrides.filter((o) => o.status === 'pending')
  const resolved = overrides.filter((o) => o.status !== 'pending')

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 flex flex-col gap-6">
      <h1 className="text-lg font-medium text-brand-brown">Override Approval Queue</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      {!canApprove && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm px-3 py-2">
          You need sales manager or admin role to approve overrides.
        </div>
      )}

      {/* Pending */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="bg-white border border-brand-stone p-6 text-center text-sm text-brand-brown/40">
            No pending overrides.
          </div>
        ) : (
          pending.map((override) => (
            <div key={override.id} className="bg-white border border-brand-stone p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/quotes/${override.quote_id}`} className="font-medium text-brand-green hover:underline">
                    {override.quote?.quote_number}
                  </Link>
                  <span className="text-brand-brown ml-2">— {override.quote?.customer_name}</span>
                  <p className="text-xs text-brand-brown/50 mt-0.5">
                    Requested by {override.requester?.full_name ?? 'Unknown'} · {format(new Date(override.created_at), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
                <StatusBadge status={override.status} />
              </div>

              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-xs text-brand-brown/50 uppercase tracking-wide block">Original</span>
                  <span className="font-medium">{formatCurrency(override.original_total)}</span>
                </div>
                <div>
                  <span className="text-xs text-brand-brown/50 uppercase tracking-wide block">Override</span>
                  <span className="font-medium">{formatCurrency(override.override_total)}</span>
                </div>
                <div>
                  <span className="text-xs text-brand-brown/50 uppercase tracking-wide block">Variance</span>
                  <span className={`font-medium ${override.variance_pct < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {override.variance_pct > 0 ? '+' : ''}{override.variance_pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {canApprove && (
                <div className="flex items-center gap-2 border-t border-brand-stone/40 pt-3">
                  <input
                    value={actionNotes[override.id] ?? ''}
                    onChange={(e) => setActionNotes((n) => ({ ...n, [override.id]: e.target.value }))}
                    placeholder="Add note (optional)"
                    className="flex-1 border border-brand-stone px-3 py-1.5 text-sm text-brand-brown focus:outline-none focus:border-brand-green"
                  />
                  <Button
                    size="sm"
                    onClick={() => resolveOverride(override.id, 'approved')}
                    loading={processing === override.id}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => resolveOverride(override.id, 'rejected')}
                    loading={processing === override.id}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* History */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium text-brand-brown uppercase tracking-wide">History ({resolved.length})</h2>
        <div className="bg-white border border-brand-stone overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-stone bg-brand-stone-light">
              <tr>
                {['Quote', 'Customer', 'Original', 'Override', 'Variance', 'Status', 'Resolved by', 'Date'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-brand-brown uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-stone/40">
              {resolved.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-brand-brown/40">No history.</td></tr>
              ) : (
                resolved.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <Link href={`/quotes/${o.quote_id}`} className="text-brand-green hover:underline">{o.quote?.quote_number}</Link>
                    </td>
                    <td className="px-4 py-3">{o.quote?.customer_name}</td>
                    <td className="px-4 py-3">{formatCurrency(o.original_total)}</td>
                    <td className="px-4 py-3">{formatCurrency(o.override_total)}</td>
                    <td className={`px-4 py-3 font-medium ${o.variance_pct < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {o.variance_pct > 0 ? '+' : ''}{o.variance_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-brand-brown/50">{o.approver?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-brand-brown/50 text-xs">{format(new Date(o.created_at), 'dd MMM yyyy')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

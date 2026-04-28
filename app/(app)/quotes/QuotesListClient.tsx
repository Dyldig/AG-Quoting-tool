'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/pricing'
import type { Quote, QuoteStatus, CustomerType, UserRole } from '@/lib/types'

interface QuotesListClientProps {
  quotes: Quote[]
  userRole: UserRole
}

type Filters = {
  status: QuoteStatus | ''
  customerType: CustomerType | ''
  search: string
  dateFrom: string
  dateTo: string
}

export function QuotesListClient({ quotes, userRole }: QuotesListClientProps) {
  const [filters, setFilters] = useState<Filters>({
    status: '',
    customerType: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  })

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      if (filters.status && q.status !== filters.status) return false
      if (filters.customerType && q.customer_type !== filters.customerType) return false
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (
          !q.customer_name.toLowerCase().includes(s) &&
          !q.quote_number.toLowerCase().includes(s) &&
          !(q.contact_name?.toLowerCase().includes(s))
        ) return false
      }
      if (filters.dateFrom && q.created_at < filters.dateFrom) return false
      if (filters.dateTo && q.created_at > filters.dateTo + 'T23:59:59') return false
      return true
    })
  }, [quotes, filters])

  function exportCSV() {
    const headers = ['Quote #', 'Customer', 'Contact', 'Region', 'Type', 'Status', 'Total', 'Override', 'Created']
    const rows = filtered.map((q) => [
      q.quote_number,
      q.customer_name,
      q.contact_name ?? '',
      (q.region as any)?.name ?? '',
      q.customer_type,
      q.status,
      '',
      q.override_total ?? '',
      format(new Date(q.created_at), 'yyyy-MM-dd'),
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quotes-${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-medium text-brand-brown">Quotes</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={exportCSV}>Export CSV</Button>
          <Link href="/quotes/new">
            <Button size="sm">New Quote</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-brand-stone p-4 mb-4 flex flex-wrap gap-3">
        <input
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search customer, quote #..."
          className="border border-brand-stone px-3 py-1.5 text-sm text-brand-brown focus:outline-none focus:border-brand-green w-48"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as any }))}
          className="border border-brand-stone px-3 py-1.5 text-sm text-brand-brown focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={filters.customerType}
          onChange={(e) => setFilters((f) => ({ ...f, customerType: e.target.value as any }))}
          className="border border-brand-stone px-3 py-1.5 text-sm text-brand-brown focus:outline-none"
        >
          <option value="">All types</option>
          <option value="distributor">Distributor</option>
          <option value="customer">Customer</option>
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
          className="border border-brand-stone px-3 py-1.5 text-sm text-brand-brown focus:outline-none"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
          className="border border-brand-stone px-3 py-1.5 text-sm text-brand-brown focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-brand-stone overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-brand-stone bg-brand-stone-light">
            <tr>
              {['Quote #', 'Customer', 'Region', 'Type', 'Status', 'Override', 'Created', ''].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-brand-brown uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-stone/40">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-brand-brown/40">
                  No quotes found.
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr key={q.id} className="hover:bg-brand-stone-light/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-brand-green">{q.quote_number}</td>
                  <td className="px-4 py-3">
                    <div>{q.customer_name}</div>
                    {q.contact_name && <div className="text-xs text-brand-brown/50">{q.contact_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-brand-brown/70">{(q.region as any)?.name ?? '—'}</td>
                  <td className="px-4 py-3 capitalize text-brand-brown/70">{q.customer_type}</td>
                  <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                  <td className="px-4 py-3">
                    {q.override_total != null && (
                      <span className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5">
                        Override
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brand-brown/50 text-xs">
                    {format(new Date(q.created_at), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/quotes/${q.id}`} className="text-xs text-brand-green hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs text-brand-brown/40">
        {filtered.length} of {quotes.length} quotes
      </div>
    </div>
  )
}

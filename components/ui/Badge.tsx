interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'green' | 'blue' | 'red' | 'yellow' | 'stone'
  className?: string
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-700',
  green: 'bg-green-50 text-green-700',
  blue: 'bg-blue-50 text-blue-700',
  red: 'bg-red-50 text-red-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  stone: 'bg-brand-stone text-brand-brown',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    draft: { label: 'Draft', variant: 'default' },
    sent: { label: 'Sent', variant: 'blue' },
    accepted: { label: 'Accepted', variant: 'green' },
    rejected: { label: 'Rejected', variant: 'red' },
    pending: { label: 'Pending', variant: 'yellow' },
    approved: { label: 'Approved', variant: 'green' },
  }
  const entry = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={entry.variant}>{entry.label}</Badge>
}

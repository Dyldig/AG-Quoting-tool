'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

interface NavProps {
  profile: Profile | null
}

const navLinks = [
  { href: '/quotes/new', label: 'New Quote' },
  { href: '/quotes', label: 'Quotes' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/regions', label: 'Regions' },
  { href: '/admin/overrides', label: 'Overrides' },
]

export function Nav({ profile }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-brand-brown text-white">
      <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-6 h-14">
        {/* Logo / wordmark */}
        <Link href="/quotes/new" className="font-medium text-brand-stone text-sm shrink-0">
          Jeffries Agriculture
          <span className="text-brand-green ml-1 font-normal">Quoting</span>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {navLinks.map((link) => {
            const active =
              link.href === '/quotes'
                ? pathname === '/quotes' || pathname.startsWith('/quotes/')
                : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'text-white font-medium'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {profile && (
            <Link
              href="/settings/profile"
              className="text-xs text-white/60 hover:text-white transition-colors"
              title="Profile settings"
            >
              {profile.full_name || profile.role}
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}

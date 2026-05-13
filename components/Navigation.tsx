'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Wrench } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: '今天', icon: Home, match: (p: string) => p === '/' },
  { href: '/marketing', label: '行銷', icon: Users, match: (p: string) => p.startsWith('/marketing') },
  { href: '/entrust', label: '開發', icon: Wrench, match: (p: string) => p.startsWith('/entrust') },
]

export default function Navigation() {
  const pathname = usePathname()

  // MBA 有自己的導航列，隱藏 CRM 導航
  if (pathname.startsWith('/m')) return null

  // 登入頁不需要導航
  if (pathname === '/login') return null

  return (
    <nav className="hidden md:flex border-b border-slate-700 bg-slate-900 sticky top-0 z-40">
      <div className="flex items-center gap-6 px-6 py-3 w-full max-w-7xl mx-auto">
        <Link
          href="/"
          className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent shrink-0"
        >
          千萬房仲 CRM
        </Link>
        <div className="flex items-center gap-1 ml-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors ${
                  active
                    ? 'bg-indigo-600/30 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon size={14} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

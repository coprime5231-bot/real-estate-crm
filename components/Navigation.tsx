'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  // MBA 有自己的導航列，隱藏 CRM 導航
  if (pathname.startsWith('/m')) return null

  // 登入頁不需要導航
  if (pathname === '/login') return null

  return (
    <nav className="hidden md:flex border-b border-slate-700 bg-slate-900 sticky top-0 z-40">
      <div className="flex items-center gap-8 px-6 py-3 w-full max-w-7xl mx-auto">
        <Link href="/marketing" className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          千萬房仲 CRM
        </Link>
      </div>
    </nav>
  )
}

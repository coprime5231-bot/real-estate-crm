'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Users,
  Video,
  Zap,
  Settings,
} from 'lucide-react'

export default function Navigation() {
  const pathname = usePathname()

  const tabs = [
    { href: '/', label: '開發', icon: Home },
    { href: '/marketing', label: '行銷', icon: Users },
    { href: '/videos', label: '短影音', icon: Video },
    { href: '/ai', label: 'AI', icon: Zap },
  ]

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex border-b border-slate-700 bg-slate-900 sticky top-0 z-40">
        <div className="flex items-center gap-8 px-6 py-4 w-full max-w-7xl mx-auto">
          <div className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            房仲CRM
          </div>
          <div className="flex gap-8 ml-8">
            {tabs.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
          <div className="ml-auto">
            <Link
              href="/setup"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              title="設置"
            >
              <Settings size={20} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-slate-700 bg-slate-900 z-40">
        <div className="flex justify-around items-center">
          {tabs.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-4 py-3 transition-all flex-1 ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400'
                }`}
              >
                <Icon size={20} />
                <span className="text-xs">{label}</span>
              </Link>
            )
          })}
          <Link
            href="/setup"
            className="flex flex-col items-center gap-1 px-4 py-3 text-slate-400 flex-1"
          >
            <Settings size={20} />
            <span className="text-xs">設置</span>
          </Link>
        </div>
      </nav>

      {/* Mobile padding */}
      <div className="md:hidden h-20" />
    </>
  )
}

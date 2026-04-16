'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const tabs = [
  { id: 'daily', label: '日任務', icon: '🏠', href: '/m' },
  { id: 'weekly', label: '週任務', icon: '📅', href: '/m/weekly' },
  { id: 'custom', label: '自訂', icon: '➕', href: null },
  { id: 'history', label: '歷史', icon: '📊', href: null },
] as const

export default function MBANav() {
  const router = useRouter()
  const pathname = usePathname()
  const currentTab = pathname === '/m/weekly' ? 'weekly' : 'daily'
  const [toast, setToast] = useState<string | null>(null)

  function handleTab(tab: (typeof tabs)[number]) {
    if (!tab.href) {
      setToast('即將推出')
      setTimeout(() => setToast(null), 1500)
      return
    }

    router.push(tab.href)
  }

  return (
    <>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '40%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(42,46,60,0.95)',
            color: '#FFD86B',
            padding: '12px 28px',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#151825',
          borderTop: '1px solid #2A2E3C',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 9000,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '10px 0 8px',
                border: 'none',
                background: 'transparent',
                color: isActive ? '#FFD86B' : '#8B8FA3',
                fontSize: 20,
                cursor: 'pointer',
                transition: 'color 0.2s',
              }}
            >
              <span>{tab.icon}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </>
  )
}

'use client'

import { useState } from 'react'

type ActionKey = 'revisit' | 'entrust' | 'deposit' | 'close'

const BUTTONS: Array<{
  action: ActionKey
  label: string
  score: number
  bg: string
}> = [
  { action: 'revisit', label: '覆看', score: 100, bg: '#3FB97A' },
  { action: 'entrust', label: '委託', score: 500, bg: '#A060FF' },
  { action: 'deposit', label: '收斡', score: 500, bg: '#A060FF' },
  { action: 'close', label: '成交', score: 5000, bg: '#FF8C42' },
]

export default function SpecialButtons() {
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState<ActionKey | null>(null)

  async function click(action: ActionKey, label: string, score: number) {
    if (loading) return
    setLoading(action)
    try {
      const res = await fetch('/api/m/tasks/special', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'failed')
      setToast(`${label} +${score}`)
    } catch (e) {
      setToast(`失敗：${(e as Error).message}`)
    } finally {
      setLoading(null)
      setTimeout(() => setToast(null), 2000)
    }
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        賞金任務 💰
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {BUTTONS.map((b) => (
          <button
            key={b.action}
            onClick={() => click(b.action, b.label, b.score)}
            disabled={loading !== null}
            style={{
              padding: '14px 10px',
              border: 'none',
              borderRadius: 12,
              background: b.bg,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading && loading !== b.action ? 0.5 : 1,
            }}
          >
            {loading === b.action ? '...' : b.label}
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2, fontWeight: 400 }}>
              +{b.score}
            </div>
          </button>
        ))}
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            background: '#FFD86B',
            color: '#0B1020',
            borderRadius: 24,
            fontSize: 16,
            fontWeight: 700,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 100,
          }}
        >
          {toast}
        </div>
      )}
    </section>
  )
}

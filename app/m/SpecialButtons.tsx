'use client'

import { useState, useRef } from 'react'
import { useAnimation } from './AnimationProvider'

type ActionKey = 'revisit' | 'entrust' | 'deposit' | 'close'

type CelebLevel = 'small' | 'medium' | 'big' | 'legendary'

const BUTTONS: Array<{
  action: ActionKey
  label: string
  score: number
  bg: string
  celebLevel: CelebLevel
}> = [
  { action: 'revisit', label: '覆看', score: 100, bg: '#3FB97A', celebLevel: 'small' },
  { action: 'entrust', label: '委託', score: 500, bg: '#A060FF', celebLevel: 'big' },
  { action: 'deposit', label: '收斡', score: 500, bg: '#A060FF', celebLevel: 'big' },
  { action: 'close', label: '成交', score: 5000, bg: '#FF8C42', celebLevel: 'legendary' },
]

export default function SpecialButtons() {
  const [loading, setLoading] = useState<ActionKey | null>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const { starBurst, scorePopup, celebrate } = useAnimation()

  async function click(action: ActionKey, label: string, score: number, celebLevel: CelebLevel) {
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

      // 取得按鈕位置觸發動畫
      const btn = btnRefs.current[action]
      if (btn) {
        const rect = btn.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        starBurst(cx, cy)
        scorePopup(`+${score}`, cx, cy - 10)
      }

      // 慶祝動畫
      celebrate(celebLevel)
    } catch {
      // 失敗不播動畫，只靠 toast（但 toast 被拔了，加回簡易版）
    } finally {
      setLoading(null)
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
            ref={(el) => { btnRefs.current[b.action] = el }}
            onClick={() => click(b.action, b.label, b.score, b.celebLevel)}
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
    </section>
  )
}

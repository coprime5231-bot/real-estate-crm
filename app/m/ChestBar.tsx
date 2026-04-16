'use client'

import { useState, useEffect } from 'react'

interface StarData {
  stars: number
  chestsAvailable: number
  quarter: string
}

export default function ChestBar() {
  const [data, setData] = useState<StarData | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/m/stats/stars')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
  }, [])

  function showToast(text: string) {
    setToast(text)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleOpen() {
    if (loading || !data || data.chestsAvailable < 1) return
    setLoading(true)
    try {
      const res = await fetch('/api/m/chest/open', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      })
      const result = await res.json()
      if (!res.ok || !result.ok) {
        showToast(result.reason === 'not_enough_stars' ? '星星不夠！' : '失敗')
        return
      }
      setData({
        stars: result.remaining_stars,
        chestsAvailable: result.chests_available,
        quarter: data.quarter,
      })
      showToast(`寶箱開出 ${result.reward_score} 分！`)
    } catch {
      showToast('開寶箱失敗')
    } finally {
      setLoading(false)
    }
  }

  if (!data) return null

  const canOpen = data.chestsAvailable > 0

  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: '#2A2E3C',
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          <span style={{ marginRight: 8 }}>⭐</span>
          {data.stars}
        </div>
        <button
          onClick={handleOpen}
          disabled={!canOpen || loading}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: 8,
            background: canOpen ? '#FFD86B' : '#3A3E4C',
            color: canOpen ? '#0B1020' : '#666',
            fontSize: 14,
            fontWeight: 700,
            cursor: canOpen && !loading ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '...' : `開寶箱 ×${data.chestsAvailable}`}
        </button>
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

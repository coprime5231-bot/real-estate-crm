'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAnimation } from './AnimationProvider'

interface PlayerData {
  totalScore: number
  level: number
  nextLevelScore: number
  prevLevelScore: number
  title: string
  streak: number
  stars: number
  chestsAvailable: number
  week: number
  daysToQuarterEnd: number
  quarter: string
}

export default function PlayerStatus() {
  const [data, setData] = useState<PlayerData | null>(null)
  const [chestLoading, setChestLoading] = useState(false)
  const { openChest } = useAnimation()

  const fetchData = useCallback(() => {
    fetch('/api/m/stats/player')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleOpenChest() {
    if (chestLoading || !data || data.chestsAvailable < 1) return
    setChestLoading(true)
    try {
      const res = await fetch('/api/m/chest/open', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      })
      const result = await res.json()
      if (!res.ok || !result.ok) {
        return
      }

      // 寶箱開啟動畫
      openChest(result.rarity ?? 'common', result.reward_score ?? 100)

      // 動畫播完後重新拉資料
      setTimeout(() => fetchData(), 3500)
    } catch {
      // silent
    } finally {
      setChestLoading(false)
    }
  }

  if (!data) {
    return (
      <section style={{ padding: '20px 0', marginBottom: 16 }}>
        <div style={{ color: '#555', fontSize: 13 }}>載入中...</div>
      </section>
    )
  }

  const progress =
    data.nextLevelScore > data.prevLevelScore
      ? ((data.totalScore - data.prevLevelScore) /
          (data.nextLevelScore - data.prevLevelScore)) *
        100
      : 100
  const progressClamped = Math.min(Math.max(progress, 0), 100)
  const canOpen = data.chestsAvailable > 0

  return (
    <section style={{ marginBottom: 20 }}>
      {/* Row 1: 等級 + 稱號 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#FFD86B',
          }}
        >
          Lv.{data.level}
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#FFB3D1',
          }}
        >
          {data.title}
        </span>
      </div>

      {/* Row 2: 分數 + 進度條 */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            color: '#8B8FA3',
            marginBottom: 4,
          }}
        >
          <span>{data.totalScore.toLocaleString()} 分</span>
          <span>→ Lv.{data.level + 1}（{data.nextLevelScore.toLocaleString()}）</span>
        </div>
        <div
          style={{
            height: 8,
            background: '#2A2E3C',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressClamped}%`,
              background: 'linear-gradient(90deg, #FFD86B, #FF8C42)',
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      {/* Row 3: ⭐ 星星 + 寶箱按鈕 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#2A2E3C',
          borderRadius: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          <span style={{ marginRight: 6 }}>⭐</span>
          {data.stars}
        </div>
        <button
          onClick={handleOpenChest}
          disabled={!canOpen || chestLoading}
          style={{
            padding: '6px 14px',
            border: 'none',
            borderRadius: 8,
            background: canOpen ? '#FFD86B' : '#3A3E4C',
            color: canOpen ? '#0B1020' : '#666',
            fontSize: 13,
            fontWeight: 700,
            cursor: canOpen && !chestLoading ? 'pointer' : 'not-allowed',
            opacity: chestLoading ? 0.6 : 1,
            transition: 'transform 0.1s',
          }}
        >
          {chestLoading ? '...' : `開寶箱 ×${data.chestsAvailable}`}
        </button>
      </div>

      {/* Row 4: 三欄小字 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#8B8FA3',
        }}
      >
        <span>本季倒數 {data.daysToQuarterEnd} 天</span>
        <span>Week {String(data.week).padStart(2, '0')}</span>
        <span>🔥 連擊 {data.streak} 天</span>
      </div>
    </section>
  )
}

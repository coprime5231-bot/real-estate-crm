'use client'

import { useState, useRef } from 'react'
import { useAnimation } from './AnimationProvider'

interface WeeklyTask {
  id: string
  task: string
  goal: string
  frequency: number
  count: number        // PG count this week
  bonusClaimed: boolean // already got the reach-target bonus
}

const CATEGORIES = ['開發', '行銷', '短影音', '自我成長'] as const
type Category = (typeof CATEGORIES)[number]

const CATEGORY_COLORS: Record<Category, string> = {
  '開發': '#4A9EFF',
  '行銷': '#A060FF',
  '短影音': '#FF8C42',
  '自我成長': '#3FB97A',
}

const CATEGORY_ICONS: Record<Category, string> = {
  '開發': '💻',
  '行銷': '📣',
  '短影音': '🎬',
  '自我成長': '📚',
}

export default function WeeklyTaskList({ tasks }: { tasks: WeeklyTask[] }) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [localCounts, setLocalCounts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const t of tasks) init[t.id] = t.count
    return init
  })
  const [localBonus, setLocalBonus] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const t of tasks) init[t.id] = t.bonusClaimed
    return init
  })
  const [loading, setLoading] = useState<string | null>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const { starBurst, scorePopup, celebrate, starPopup } = useAnimation()

  // Group tasks by goal (category)
  const grouped = new Map<Category, WeeklyTask[]>()
  for (const cat of CATEGORIES) grouped.set(cat, [])
  for (const t of tasks) {
    const cat = CATEGORIES.includes(t.goal as Category) ? (t.goal as Category) : null
    if (cat) grouped.get(cat)!.push(t)
  }

  // Category summary: done/total
  function categorySummary(cat: Category) {
    const catTasks = grouped.get(cat) ?? []
    const total = catTasks.reduce((s, t) => s + t.frequency, 0)
    const done = catTasks.reduce((s, t) => s + Math.min(localCounts[t.id] ?? t.count, t.frequency), 0)
    return { done, total, taskCount: catTasks.length }
  }

  async function handleComplete(task: WeeklyTask) {
    if (loading) return
    const refKey = task.id
    setLoading(refKey)

    try {
      const res = await fetch('/api/m/tasks/weekly', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          notionPageId: task.id,
          taskName: task.task,
          frequency: task.frequency,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'failed')

      const newCount = (localCounts[task.id] ?? task.count) + 1
      setLocalCounts((prev) => ({ ...prev, [task.id]: newCount }))

      // Animation: star burst + score popup on the button
      const btn = btnRefs.current[refKey]
      if (btn) {
        const rect = btn.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        starBurst(cx, cy)
        scorePopup(`+${data.score}`, cx, cy - 10)
      }

      // Target reached: center star popup
      if (data.bonus && !localBonus[task.id]) {
        setLocalBonus((prev) => ({ ...prev, [task.id]: true }))
        celebrate('small')
        if (data.stars > 0) {
          starPopup(data.stars)
        }
      }
    } catch {
      // error — no toast, just stop loading
    } finally {
      setLoading(null)
    }
  }

  // ===== Layer 1: Category buttons =====
  if (!selectedCategory) {
    return (
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
          本週任務
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {CATEGORIES.map((cat) => {
            const { done, total, taskCount } = categorySummary(cat)
            const allDone = total > 0 && done >= total
            return (
              <button
                key={cat}
                onClick={() => taskCount > 0 && setSelectedCategory(cat)}
                style={{
                  padding: '24px 16px',
                  border: 'none',
                  borderRadius: 16,
                  background: allDone ? '#1A2A1A' : '#2A2E3C',
                  borderLeft: `4px solid ${CATEGORY_COLORS[cat]}`,
                  cursor: taskCount > 0 ? 'pointer' : 'default',
                  opacity: taskCount === 0 ? 0.4 : 1,
                  textAlign: 'left',
                  transition: 'transform 0.15s',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{CATEGORY_ICONS[cat]}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#F5F5FA', marginBottom: 4 }}>
                  {cat}
                </div>
                <div style={{
                  fontSize: 15,
                  color: allDone ? '#3FB97A' : '#8B8FA3',
                  fontWeight: allDone ? 700 : 400,
                }}>
                  {allDone ? '✅ ' : ''}{done}/{total} 完成
                </div>
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  // ===== Layer 2: Task cards for selected category =====
  const catTasks = grouped.get(selectedCategory) ?? []

  return (
    <section style={{ marginBottom: 32 }}>
      <button
        onClick={() => setSelectedCategory(null)}
        style={{
          background: 'none',
          border: 'none',
          color: '#8B8FA3',
          fontSize: 16,
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        ← 返回分區
      </button>

      <h2 style={{
        fontSize: 22,
        fontWeight: 600,
        marginBottom: 16,
        color: CATEGORY_COLORS[selectedCategory],
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {CATEGORY_ICONS[selectedCategory]} {selectedCategory}
      </h2>

      {catTasks.length === 0 ? (
        <div style={{ color: '#8B8FA3', fontSize: 16 }}>
          （這個分區沒有任務）
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {catTasks.map((t) => {
            const count = localCounts[t.id] ?? t.count
            const reached = count >= t.frequency
            const isLoading = loading === t.id

            return (
              <li
                key={t.id}
                style={{
                  padding: '24px 28px',
                  marginBottom: 12,
                  background: reached ? '#1A2A1A' : '#2A2E3C',
                  borderRadius: 14,
                  borderLeft: `4px solid ${reached ? '#3FB97A' : CATEGORY_COLORS[selectedCategory]}`,
                  transition: 'background 0.3s',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <span style={{ fontWeight: 600, fontSize: 20 }}>
                    {reached && '✅ '}{t.task}
                  </span>
                  <span style={{
                    fontSize: 18,
                    color: reached ? '#3FB97A' : '#8B8FA3',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {count}/{t.frequency}
                  </span>
                </div>

                <button
                  ref={(el) => { btnRefs.current[t.id] = el }}
                  onClick={() => handleComplete(t)}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    fontSize: 20,
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: 10,
                    background: reached ? '#2A5A2A' : CATEGORY_COLORS[selectedCategory],
                    color: '#fff',
                    cursor: isLoading ? 'wait' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {isLoading ? '...' : '完成 +1'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

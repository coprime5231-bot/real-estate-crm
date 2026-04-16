'use client'

import { useState, useCallback, useRef } from 'react'
import { useAnimation } from './AnimationProvider'

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

const DAY_LABELS: Array<{ key: DayKey; label: string }> = [
  { key: 'mon', label: '一' },
  { key: 'tue', label: '二' },
  { key: 'wed', label: '三' },
  { key: 'thu', label: '四' },
  { key: 'fri', label: '五' },
  { key: 'sat', label: '六' },
  { key: 'sun', label: '日' },
]

interface WeeklyTask {
  id: string
  task: string
  goal: string
  frequency: number
  checks: Record<string, boolean>
}

// 目標分類 → 顏色
const GOAL_COLORS: Record<string, string> = {
  '開發': '#4A9EFF',
  '行銷': '#A060FF',
  '短影音': '#FF8C42',
  '自我成長': '#3FB97A',
}

function goalColor(goal: string): string {
  return GOAL_COLORS[goal] ?? '#8B8FA3'
}

function checkedCount(checks: Record<string, boolean>): number {
  return Object.values(checks).filter(Boolean).length
}

export default function WeeklyTaskList({ tasks }: { tasks: WeeklyTask[] }) {
  // 本地 checks state（optimistic update 用）
  const [localChecks, setLocalChecks] = useState<Record<string, Record<string, boolean>>>(() => {
    const init: Record<string, Record<string, boolean>> = {}
    for (const t of tasks) {
      init[t.id] = { ...t.checks }
    }
    return init
  })

  const [loading, setLoading] = useState<string | null>(null) // "pageId-day"
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const { starBurst, scorePopup, celebrate } = useAnimation()

  const showToast = useCallback((text: string, isError = false) => {
    setToast({ text, isError })
    setTimeout(() => setToast(null), 2000)
  }, [])

  async function toggleCheck(task: WeeklyTask, day: DayKey) {
    const loadingKey = `${task.id}-${day}`
    if (loading) return

    const currentChecks = localChecks[task.id] ?? task.checks
    const newChecked = !currentChecks[day]

    // Optimistic update
    setLoading(loadingKey)
    setLocalChecks((prev) => ({
      ...prev,
      [task.id]: { ...prev[task.id], [day]: newChecked },
    }))

    try {
      const res = await fetch('/api/m/tasks/weekly', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          notionPageId: task.id,
          day,
          checked: newChecked,
          taskName: task.task,
          frequency: task.frequency,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'failed')

      if (newChecked && data.score > 0) {
        // 動畫
        const btn = btnRefs.current[loadingKey]
        if (btn) {
          const rect = btn.getBoundingClientRect()
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          starBurst(cx, cy)
          scorePopup(`+${data.score}`, cx, cy - 10)
        }

        if (data.bonus) {
          // 達標慶祝
          celebrate('small')
          const starsText = data.stars > 0 ? ` ⭐+${data.stars}` : ''
          showToast(`${task.task} 🎯達標！${starsText}`)
        }
      }
    } catch (err) {
      // Revert optimistic update
      setLocalChecks((prev) => ({
        ...prev,
        [task.id]: { ...prev[task.id], [day]: !newChecked },
      }))
      showToast(`失敗：${(err as Error).message}`, true)
    } finally {
      setLoading(null)
    }
  }

  // 依目標分組
  const grouped = new Map<string, WeeklyTask[]>()
  for (const t of tasks) {
    const g = t.goal || '其他'
    if (!grouped.has(g)) grouped.set(g, [])
    grouped.get(g)!.push(t)
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        本週任務（{tasks.length}）
      </h2>

      {tasks.length === 0 ? (
        <div style={{ color: '#8B8FA3', fontSize: 14 }}>
          （本週沒有任務，請到 Notion 新增）
        </div>
      ) : (
        Array.from(grouped.entries()).map(([goal, gTasks]) => (
          <div key={goal} style={{ marginBottom: 16 }}>
            {/* 目標標題 */}
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: goalColor(goal),
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: goalColor(goal),
                  display: 'inline-block',
                }}
              />
              {goal}
            </div>

            {gTasks.map((t) => {
              const checks = localChecks[t.id] ?? t.checks
              const done = checkedCount(checks)
              const reached = done >= t.frequency

              return (
                <div
                  key={t.id}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 6,
                    background: reached ? '#1A2A1A' : '#2A2E3C',
                    borderRadius: 10,
                    borderLeft: `3px solid ${reached ? '#3FB97A' : goalColor(goal)}`,
                    transition: 'background 0.3s',
                  }}
                >
                  {/* 任務名 + 進度 */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontWeight: 500, fontSize: 14 }}>
                      {reached && '✅ '}{t.task}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: reached ? '#3FB97A' : '#8B8FA3',
                        fontWeight: reached ? 700 : 400,
                      }}
                    >
                      {done}/{t.frequency}
                    </span>
                  </div>

                  {/* 7 天 checkbox 列 */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {DAY_LABELS.map(({ key, label }) => {
                      const isChecked = !!checks[key]
                      const isLoading = loading === `${t.id}-${key}`

                      return (
                        <button
                          key={key}
                          ref={(el) => { btnRefs.current[`${t.id}-${key}`] = el }}
                          onClick={() => toggleCheck(t, key)}
                          disabled={loading !== null}
                          style={{
                            flex: 1,
                            padding: '4px 0',
                            fontSize: 11,
                            fontWeight: isChecked ? 700 : 400,
                            border: 'none',
                            borderRadius: 6,
                            background: isChecked ? '#3FB97A' : '#3A3E4C',
                            color: isChecked ? '#fff' : '#8B8FA3',
                            cursor: loading ? 'wait' : 'pointer',
                            opacity: isLoading ? 0.6 : 1,
                            transition: 'background 0.15s',
                          }}
                        >
                          {isLoading ? '·' : label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            background: toast.isError ? '#FF5252' : '#FFD86B',
            color: toast.isError ? '#fff' : '#0B1020',
            borderRadius: 24,
            fontSize: 16,
            fontWeight: 700,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 100,
          }}
        >
          {toast.text}
        </div>
      )}
    </section>
  )
}

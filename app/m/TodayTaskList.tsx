'use client'

import { useState, useRef } from 'react'
import type { TodayTask, TaskKind } from '@/lib/mba/calendar'
import { useAnimation } from './AnimationProvider'

const KIND_LABEL: Record<TaskKind, string> = {
  visit: '拜訪',
  visit_revisit: '覆訪',
  viewing: '帶看',
}

type VisitAction = 'invalid' | 'retry' | 'found'
type ViewingAction = 'no' | 'yes'

const VISIT_BUTTONS: Array<{ label: string; action: VisitAction }> = [
  { label: '無效', action: 'invalid' },
  { label: '再來一次', action: 'retry' },
  { label: '找到人了', action: 'found' },
]

const VIEWING_BUTTONS: Array<{ label: string; action: ViewingAction }> = [
  { label: '沒興趣', action: 'no' },
  { label: '有興趣', action: 'yes' },
]

interface TaskState {
  done: boolean
  loading: string | null
}

export default function TodayTaskList({ tasks }: { tasks: TodayTask[] }) {
  const [states, setStates] = useState<Record<string, TaskState>>(() => {
    const init: Record<string, TaskState> = {}
    for (const t of tasks) {
      init[t.eventId] = { done: t.isDone, loading: null }
    }
    return init
  })

  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const { starBurst, scorePopup, celebrate } = useAnimation()

  function setLoading(eventId: string, action: string | null) {
    setStates((prev) => ({
      ...prev,
      [eventId]: { ...prev[eventId], loading: action },
    }))
  }

  function setDone(eventId: string) {
    setStates((prev) => ({
      ...prev,
      [eventId]: { done: true, loading: null },
    }))
  }

  function triggerAnim(refKey: string, score: number) {
    const btn = btnRefs.current[refKey]
    if (btn) {
      const rect = btn.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      starBurst(cx, cy)
      scorePopup(`+${score}`, cx, cy - 10)
    }
  }

  async function handleVisit(
    task: TodayTask,
    action: VisitAction,
    label: string,
  ) {
    const s = states[task.eventId]
    if (s?.done || s?.loading) return

    setLoading(task.eventId, action)
    try {
      const res = await fetch('/api/m/tasks/visit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId: task.eventId,
          action,
          summary: task.summary,
          description: task.description,
          distanceKm: task.distanceKm,
        }),
      })
      const data = await res.json()

      if (data.ok === false && data.reason === 'already_done') {
        setDone(task.eventId)
        return
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed')

      setDone(task.eventId)

      // 動畫
      const refKey = `${task.eventId}-${action}`
      triggerAnim(refKey, data.totalScore)

      if (action === 'found') {
        // 找到人了 = 藍卡 → medium 慶祝
        celebrate('medium')
      }
    } catch {
      setLoading(task.eventId, null)
    }
  }

  async function handleViewing(
    task: TodayTask,
    action: ViewingAction,
    label: string,
  ) {
    const s = states[task.eventId]
    if (s?.done || s?.loading) return

    setLoading(task.eventId, action)
    try {
      const res = await fetch('/api/m/tasks/viewing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId: task.eventId,
          action,
          description: task.description,
        }),
      })
      const data = await res.json()

      if (data.ok === false && data.reason === 'already_done') {
        setDone(task.eventId)
        return
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed')

      setDone(task.eventId)

      // 動畫
      const refKey = `${task.eventId}-${action}`
      triggerAnim(refKey, data.totalScore)
    } catch {
      setLoading(task.eventId, null)
    }
  }

  const isVisit = (kind: TaskKind) =>
    kind === 'visit' || kind === 'visit_revisit'

  function openMaps(address: string) {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
      '_blank',
    )
  }

  // Sort: undone first, done last
  const sortedTasks = [...tasks].sort((a, b) => {
    const aDone = states[a.eventId]?.done ?? a.isDone
    const bDone = states[b.eventId]?.done ?? b.isDone
    if (aDone === bDone) return 0
    return aDone ? 1 : -1
  })

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
        今日任務（{tasks.length}）
      </h2>

      {tasks.length === 0 ? (
        <div style={{ color: '#8B8FA3', fontSize: 16 }}>
          （今天沒有拜訪/覆訪/帶看行程）
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {sortedTasks.map((t) => {
            const s = states[t.eventId] ?? { done: t.isDone, loading: null }
            const done = s.done
            const loading = s.loading

            return (
              <li
                key={t.eventId}
                style={{
                  padding: done ? '16px 20px' : '32px 40px',
                  marginBottom: 12,
                  background: done ? '#1E2130' : '#2A2E3C',
                  borderRadius: 14,
                  opacity: done ? 0.6 : 1,
                  maxHeight: done ? 60 : 'none',
                  overflow: 'hidden',
                  transition: 'opacity 0.3s, background 0.3s, max-height 0.4s, padding 0.3s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: done ? 17 : 24 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        marginRight: 8,
                        fontSize: done ? 11 : 14,
                        borderRadius: 4,
                        background:
                          t.kind === 'viewing' ? '#A060FF' : '#4A9EFF',
                        color: '#fff',
                      }}
                    >
                      {KIND_LABEL[t.kind]}
                    </span>
                    {done && '✅ '}{t.summary}
                  </div>
                  <div style={{ fontSize: done ? 13 : 16, color: '#8B8FA3', whiteSpace: 'nowrap', marginLeft: 8 }}>
                    {t.timeLabel}
                  </div>
                </div>

                {!done && t.location && (
                  <div
                    onClick={() => openMaps(t.location!)}
                    style={{
                      fontSize: 18,
                      color: '#8B8FA3',
                      marginTop: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>📍</span>
                    <span style={{ textDecoration: 'underline', textDecorationColor: '#555', textUnderlineOffset: 2 }}>
                      {t.location}
                    </span>
                    {t.distanceKm !== null && (
                      <span style={{ marginLeft: 6, color: '#FFD86B', fontSize: 18 }}>
                        {t.distanceKm.toFixed(1)}km
                        {t.distanceBonus > 0 && ` (+${t.distanceBonus})`}
                      </span>
                    )}
                  </div>
                )}

                {!done && (
                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    {isVisit(t.kind)
                      ? VISIT_BUTTONS.map((b) => (
                          <button
                            key={b.action}
                            ref={(el) => { btnRefs.current[`${t.eventId}-${b.action}`] = el }}
                            disabled={done || loading !== null}
                            onClick={() => handleVisit(t, b.action, b.label)}
                            style={{
                              flex: 1,
                              minWidth: 80,
                              padding: '12px 16px',
                              fontSize: 20,
                              border: 'none',
                              borderRadius: 8,
                              background:
                                b.action === 'found'
                                  ? '#4A9EFF'
                                  : '#4A4E5C',
                              color: '#fff',
                              cursor:
                                loading !== null
                                  ? 'not-allowed'
                                  : 'pointer',
                              opacity:
                                loading && loading !== b.action ? 0.5 : 1,
                              fontWeight: b.action === 'found' ? 700 : 400,
                            }}
                          >
                            {loading === b.action ? '...' : b.label}
                          </button>
                        ))
                      : VIEWING_BUTTONS.map((b) => (
                          <button
                            key={b.action}
                            ref={(el) => { btnRefs.current[`${t.eventId}-${b.action}`] = el }}
                            disabled={done || loading !== null}
                            onClick={() =>
                              handleViewing(t, b.action, b.label)
                            }
                            style={{
                              flex: 1,
                              minWidth: 80,
                              padding: '12px 16px',
                              fontSize: 20,
                              border: 'none',
                              borderRadius: 8,
                              background:
                                b.action === 'yes'
                                  ? '#A060FF'
                                  : '#4A4E5C',
                              color: '#fff',
                              cursor:
                                loading !== null
                                  ? 'not-allowed'
                                  : 'pointer',
                              opacity:
                                loading && loading !== b.action ? 0.5 : 1,
                              fontWeight: b.action === 'yes' ? 700 : 400,
                            }}
                          >
                            {loading === b.action ? '...' : b.label}
                          </button>
                        ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

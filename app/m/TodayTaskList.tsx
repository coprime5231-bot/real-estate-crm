'use client'

import { useState } from 'react'
import type { TodayTask, TaskKind } from '@/lib/mba/calendar'

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

  const [toast, setToast] = useState<{
    text: string
    isError: boolean
  } | null>(null)

  function showToast(text: string, isError = false) {
    setToast({ text, isError })
    setTimeout(() => setToast(null), 2000)
  }

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
        showToast('已經按過了', true)
        return
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed')

      setDone(task.eventId)
      showToast(`${label} +${data.totalScore}`)
    } catch (err) {
      setLoading(task.eventId, null)
      showToast(`失敗：${(err as Error).message}`, true)
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
        showToast('已經按過了', true)
        return
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'failed')

      setDone(task.eventId)
      showToast(`${label} +${data.totalScore}`)
    } catch (err) {
      setLoading(task.eventId, null)
      showToast(`失敗：${(err as Error).message}`, true)
    }
  }

  const isVisit = (kind: TaskKind) =>
    kind === 'visit' || kind === 'visit_revisit'

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        今日任務（{tasks.length}）
      </h2>

      {tasks.length === 0 ? (
        <div style={{ color: '#8B8FA3', fontSize: 14 }}>
          （今天沒有拜訪/覆訪/帶看行程）
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {tasks.map((t) => {
            const s = states[t.eventId] ?? { done: t.isDone, loading: null }
            const done = s.done
            const loading = s.loading

            return (
              <li
                key={t.eventId}
                style={{
                  padding: '12px 14px',
                  marginBottom: 10,
                  background: done ? '#1E2130' : '#2A2E3C',
                  borderRadius: 12,
                  opacity: done ? 0.55 : 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        marginRight: 6,
                        fontSize: 11,
                        borderRadius: 4,
                        background:
                          t.kind === 'viewing' ? '#A060FF' : '#4A9EFF',
                        color: '#fff',
                      }}
                    >
                      {KIND_LABEL[t.kind]}
                    </span>
                    {t.summary}
                  </div>
                  <div style={{ fontSize: 12, color: '#8B8FA3' }}>
                    {t.timeLabel}
                  </div>
                </div>

                {t.location && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#8B8FA3',
                      marginTop: 4,
                    }}
                  >
                    {t.location}
                    {t.distanceKm !== null && (
                      <span style={{ marginLeft: 6, color: '#FFD86B' }}>
                        {t.distanceKm.toFixed(1)}km
                        {t.distanceBonus > 0 && ` (+${t.distanceBonus})`}
                      </span>
                    )}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  {isVisit(t.kind)
                    ? VISIT_BUTTONS.map((b) => (
                        <button
                          key={b.action}
                          disabled={done || loading !== null}
                          onClick={() => handleVisit(t, b.action, b.label)}
                          style={{
                            flex: 1,
                            minWidth: 70,
                            padding: '6px 10px',
                            fontSize: 12,
                            border: 'none',
                            borderRadius: 6,
                            background:
                              done
                                ? '#3A3E4C'
                                : b.action === 'found'
                                  ? '#4A9EFF'
                                  : '#4A4E5C',
                            color: done ? '#666' : '#fff',
                            cursor:
                              done || loading !== null
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
                          disabled={done || loading !== null}
                          onClick={() =>
                            handleViewing(t, b.action, b.label)
                          }
                          style={{
                            flex: 1,
                            minWidth: 70,
                            padding: '6px 10px',
                            fontSize: 12,
                            border: 'none',
                            borderRadius: 6,
                            background:
                              done
                                ? '#3A3E4C'
                                : b.action === 'yes'
                                  ? '#A060FF'
                                  : '#4A4E5C',
                            color: done ? '#666' : '#fff',
                            cursor:
                              done || loading !== null
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
              </li>
            )
          })}
        </ul>
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

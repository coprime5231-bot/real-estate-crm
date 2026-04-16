import { getWeekInfo } from '@/lib/mba/week-calc'
import { headers } from 'next/headers'
import type { TodayTask } from '@/lib/mba/calendar'
import SpecialButtons from './SpecialButtons'
import TodayTaskList from './TodayTaskList'

export const dynamic = 'force-dynamic'

type WeeklyTask = {
  id: string
  task: string
  goal: string
  frequency: number
  checks: Record<string, boolean>
}

async function fetchInternal<T>(path: string, fallback: T): Promise<T> {
  const h = headers()
  const host = h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const cookie = h.get('cookie') ?? ''
  try {
    const res = await fetch(`${proto}://${host}${path}`, {
      headers: { cookie },
      cache: 'no-store',
      redirect: 'manual',
    })
    if (!res.ok) return fallback
    if (!res.headers.get('content-type')?.includes('application/json')) return fallback
    return (await res.json()) as T
  } catch {
    return fallback
  }
}

async function getWeeklyTasks(): Promise<WeeklyTask[]> {
  const data = await fetchInternal<{ tasks?: WeeklyTask[] }>('/api/notion/weekly-tasks', {})
  return data.tasks ?? []
}

async function getTodayTasks(): Promise<TodayTask[]> {
  const data = await fetchInternal<{ tasks?: TodayTask[] }>('/api/m/calendar/today', {})
  return data.tasks ?? []
}

export default async function MBAHome() {
  const week = getWeekInfo(new Date())
  const [todayTasks, weeklyTasks] = await Promise.all([getTodayTasks(), getWeeklyTasks()])

  return (
    <main style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: '#8B8FA3' }}>{week.quarter}</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '4px 0' }}>
          Week {String(week.week).padStart(2, '0')} ⭐
        </h1>
        <div style={{ fontSize: 12, color: '#8B8FA3' }}>
          本季倒數 {week.daysToQuarterEnd} 天
        </div>
      </header>

      <SpecialButtons />

      <TodayTaskList tasks={todayTasks} />

      {/* ===== 本週任務 ===== */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          本週任務（{weeklyTasks.length}）
        </h2>
        {weeklyTasks.length === 0 ? (
          <div style={{ color: '#8B8FA3', fontSize: 14 }}>
            （本週沒有任務，請到 Notion 新增）
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {weeklyTasks.map((t) => (
              <li
                key={t.id}
                style={{
                  padding: '12px 14px',
                  marginBottom: 8,
                  background: '#2A2E3C',
                  borderRadius: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{t.task}</div>
                  <div style={{ fontSize: 12, color: '#8B8FA3', marginTop: 2 }}>
                    {t.goal} · {t.frequency}x/週
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer style={{ marginTop: 40, fontSize: 11, color: '#555', textAlign: 'center' }}>
        MBA Step 5b · 🐈
      </footer>
    </main>
  )
}

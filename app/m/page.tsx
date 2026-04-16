import { getWeekInfo } from '@/lib/mba/week-calc'
import { headers } from 'next/headers'
import type { TodayTask } from '@/lib/mba/calendar'
import SpecialButtons from './SpecialButtons'
import TodayTaskList from './TodayTaskList'
import WeeklyTaskList from './WeeklyTaskList'
import ChestBar from './ChestBar'

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

      <ChestBar />

      <SpecialButtons />

      <TodayTaskList tasks={todayTasks} />

      <WeeklyTaskList tasks={weeklyTasks} />

      <footer style={{ marginTop: 40, fontSize: 11, color: '#555', textAlign: 'center' }}>
        MBA Step 6 · 🐈
      </footer>
    </main>
  )
}

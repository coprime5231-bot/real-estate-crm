import { headers } from 'next/headers'
import type { TodayTask } from '@/lib/mba/calendar'
import SpecialButtons from './SpecialButtons'
import TodayTaskList from './TodayTaskList'
import PlayerStatus from './PlayerStatus'
import PullToRefresh from './PullToRefresh'

export const dynamic = 'force-dynamic'

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

async function getTodayTasks(): Promise<TodayTask[]> {
  const data = await fetchInternal<{ tasks?: TodayTask[] }>('/api/m/calendar/today', {})
  return data.tasks ?? []
}

export default async function MBAHome() {
  const todayTasks = await getTodayTasks()

  return (
    <PullToRefresh>
      <main style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>
        <PlayerStatus />

        <SpecialButtons />

        <div id="mba-daily">
          <TodayTaskList tasks={todayTasks} />
        </div>

        <footer style={{ marginTop: 40, fontSize: 11, color: '#555', textAlign: 'center' }}>
          MBA Step 8c · 🐈
        </footer>
      </main>
    </PullToRefresh>
  )
}

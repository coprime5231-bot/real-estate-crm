import { headers } from 'next/headers'
import WeeklyTaskList from '../WeeklyTaskList'

export const dynamic = 'force-dynamic'

type WeeklyTaskAPI = {
  id: string
  task: string
  goal: string
  frequency: number
  count: number
  bonusClaimed: boolean
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

async function getWeeklyTasks(): Promise<WeeklyTaskAPI[]> {
  const data = await fetchInternal<{ tasks?: WeeklyTaskAPI[] }>('/api/m/tasks/weekly', {})
  return data.tasks ?? []
}

export default async function WeeklyPage() {
  const tasks = await getWeeklyTasks()

  return (
    <main style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>
      <WeeklyTaskList tasks={tasks} />

      <footer style={{ marginTop: 40, fontSize: 11, color: '#555', textAlign: 'center' }}>
        MBA Step 8c · 🐈
      </footer>
    </main>
  )
}

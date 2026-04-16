import { Pool } from 'pg'

// Next.js dev 模式 hot reload 會重複 require module，
// 用 globalThis 做 singleton 避免 connection 累積。
declare global {
  // eslint-disable-next-line no-var
  var __mbaPgPool: Pool | undefined
}

export const pool: Pool =
  globalThis.__mbaPgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__mbaPgPool = pool
}

export function currentQuarter(d: Date = new Date()): string {
  const y = d.getFullYear()
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${y}Q${q}`
}

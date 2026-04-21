import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/mba/db'

// G21: 本 route 用 searchParams，Next.js 14 build 時沒標 dynamic 會炸 DYNAMIC_SERVER_USAGE。
export const dynamic = 'force-dynamic'

const SERPER_ENDPOINT = 'https://google.serper.dev/search'
const SERPER_TIMEOUT_MS = 5000

type LejuSearchResponse =
  | { url: string; source: 'cache' | 'serper' }
  | { url: null; source: 'none' }
  | { error: string; source: 'error' }

export async function GET(request: NextRequest) {
  const rawName = request.nextUrl.searchParams.get('name') || ''
  const name = rawName.trim()
  if (!name) {
    const body: LejuSearchResponse = { error: 'name is required', source: 'error' }
    return NextResponse.json(body, { status: 400 })
  }

  // 1) 先查 cache
  try {
    const cacheRes = await pool.query<{ leju_url: string | null }>(
      'SELECT leju_url FROM communities WHERE name = $1 LIMIT 1',
      [name]
    )
    const cached = cacheRes.rows[0]?.leju_url
    if (cached) {
      const body: LejuSearchResponse = { url: cached, source: 'cache' }
      return NextResponse.json(body)
    }
  } catch (err: any) {
    console.error('leju search: PG cache lookup failed', err?.message || err)
    // cache 讀失敗不致命；繼續打 Serper
  }

  // 2) 打 Serper
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    const body: LejuSearchResponse = { error: 'SERPER_API_KEY missing', source: 'error' }
    return NextResponse.json(body, { status: 500 })
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), SERPER_TIMEOUT_MS)
  let serperJson: any
  try {
    const res = await fetch(SERPER_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: `${name} site:leju.com.tw` }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`leju search: Serper ${res.status}`, text.slice(0, 200))
      const body: LejuSearchResponse = { error: `Serper ${res.status}`, source: 'error' }
      return NextResponse.json(body, { status: 500 })
    }
    serperJson = await res.json()
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Serper timeout' : err?.message || String(err)
    console.error('leju search: Serper fetch failed', msg)
    const body: LejuSearchResponse = { error: msg, source: 'error' }
    return NextResponse.json(body, { status: 500 })
  } finally {
    clearTimeout(timer)
  }

  const firstLink: string | undefined = serperJson?.organic?.[0]?.link
  if (!firstLink || typeof firstLink !== 'string') {
    const body: LejuSearchResponse = { url: null, source: 'none' }
    return NextResponse.json(body)
  }

  // 3) UPSERT 回 cache（沿用 /api/viewings 同樣 ON CONFLICT (name) 語法；新列 leju_url 覆蓋舊列，舊列若有非空值就用 COALESCE 保留）
  try {
    await pool.query(
      `INSERT INTO communities (name, leju_url)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET
         leju_url = COALESCE(communities.leju_url, EXCLUDED.leju_url),
         updated_at = NOW()`,
      [name, firstLink]
    )
  } catch (err: any) {
    console.error('leju search: UPSERT communities failed', err?.message || err)
    // 寫 cache 失敗不致命，仍回結果給前端
  }

  const body: LejuSearchResponse = { url: firstLink, source: 'serper' }
  return NextResponse.json(body)
}

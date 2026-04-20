import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/mba/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/communities?q=xxx&limit=10
 * Autocomplete 端點：回傳最近使用的社區 + 樂居連結。
 * 空 q → 回最近 10 筆（updated_at DESC）；有 q → name ILIKE '%q%' 模糊搜尋。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const limitRaw = parseInt(searchParams.get('limit') || '10', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 10, 1), 50)

  try {
    const res = q
      ? await pool.query(
          `SELECT id, name, leju_url FROM communities
           WHERE name ILIKE '%' || $1 || '%'
           ORDER BY updated_at DESC
           LIMIT $2`,
          [q, limit]
        )
      : await pool.query(
          `SELECT id, name, leju_url FROM communities
           ORDER BY updated_at DESC
           LIMIT $1`,
          [limit]
        )
    return NextResponse.json(res.rows)
  } catch (err: any) {
    console.error('communities GET failed:', err?.message || err)
    return NextResponse.json(
      { error: '搜尋社區失敗', detail: err?.message },
      { status: 500 }
    )
  }
}

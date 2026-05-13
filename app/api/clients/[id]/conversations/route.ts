import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/mba/db'

/**
 * GET /api/clients/[id]/conversations
 * 列出該買方的所有洽談記錄，依 date DESC、id DESC（同一天新的在前）。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  try {
    const res = await pool.query(
      `SELECT id, notion_buyer_id, notion_person_id, date, content, created_at, updated_at
       FROM conversations
       WHERE notion_person_id = $1
       ORDER BY date DESC, id DESC`,
      [id]
    )
    return NextResponse.json({ conversations: res.rows })
  } catch (err: any) {
    console.error('GET client conversations failed:', err?.message || err)
    return NextResponse.json(
      { error: '讀取洽談記錄失敗', detail: err?.message },
      { status: 500 }
    )
  }
}

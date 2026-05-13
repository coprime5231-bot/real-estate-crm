import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/mba/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/[id]/viewings
 * 查該客戶所有帶看記錄，依規則排序：
 *   🟣 liked 置頂 → 預設 (NULL) → ⚫ disliked 底部
 *   同組內：datetime DESC
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
      `SELECT
         id, calendar_event_id, notion_person_id, datetime, location,
         community_name, community_url, community_leju_url,
         colleague_name, colleague_phone, note, opinion, created_at
       FROM viewings
       WHERE notion_person_id = $1
       ORDER BY
         CASE
           WHEN opinion = 'liked'    THEN 0
           WHEN opinion IS NULL      THEN 1
           WHEN opinion = 'disliked' THEN 2
           ELSE 1
         END,
         datetime DESC`,
      [id]
    )
    return NextResponse.json(res.rows)
  } catch (err: any) {
    console.error('GET client viewings failed:', err?.message || err)
    return NextResponse.json(
      { error: '讀取帶看記錄失敗', detail: err?.message },
      { status: 500 }
    )
  }
}

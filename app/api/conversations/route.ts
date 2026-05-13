import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/mba/db'
import { resolveBothIds } from '@/lib/mba/id-map'

export const dynamic = 'force-dynamic'

/**
 * POST /api/conversations
 * 純 PG 新增洽談記錄（不寫 Notion）。quick-log 路由負責「洽談 + Notion body + 日期 +3」組合動作；
 * 此端點供未來不走 Notion 的情境使用。
 *
 * Body: { notionBuyerId: string, content: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const notionBuyerId = (body.notionBuyerId || '').trim()
    const content = (body.content || '').trim()

    if (!notionBuyerId) {
      return NextResponse.json({ error: 'notionBuyerId 必填' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ error: 'content 不可為空' }, { status: 400 })
    }

    // Phase 4.1c/4.2 dual-write
    const ids = await resolveBothIds(notionBuyerId)

    const res = await pool.query(
      `INSERT INTO conversations (notion_buyer_id, notion_person_id, date, content)
       VALUES ($1, $2, CURRENT_DATE, $3)
       RETURNING id, notion_buyer_id, notion_person_id, date, content, created_at, updated_at`,
      [ids.knownAsBuyer || ids.knownAsPerson ? ids.buyerNotionId : null, ids.personId, content]
    )

    return NextResponse.json({ conversation: res.rows[0] })
  } catch (err: any) {
    console.error('POST /api/conversations failed:', err?.message || err)
    return NextResponse.json({ error: '新增洽談失敗', detail: err?.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/mba/db'
import { formatConversationBodyLine, updateBodyBlockText } from '@/lib/notion-body-log'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/conversations/[id]
 * 更新洽談內容（click-to-edit）。
 *
 * Body: { content: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 })
    }

    const body = await request.json()
    const hasContent = typeof body.content === 'string'
    const hasImportant = typeof body.isImportant === 'boolean'
    const content = hasContent ? body.content.trim() : ''

    if (!hasContent && !hasImportant) {
      return NextResponse.json({ error: '無可更新欄位' }, { status: 400 })
    }
    if (hasContent && !content) {
      return NextResponse.json({ error: 'content 不可為空' }, { status: 400 })
    }

    // 動態組 SET
    const sets: string[] = []
    const vals: any[] = []
    let i = 1
    if (hasContent) {
      sets.push(`content = $${i++}`, `updated_at = NOW()`)
      vals.push(content)
    }
    if (hasImportant) {
      sets.push(`is_important = $${i++}`)
      vals.push(body.isImportant)
    }
    vals.push(id)

    const res = await pool.query(
      `UPDATE conversations
       SET ${sets.join(', ')}
       WHERE id = $${i}
       RETURNING id, notion_buyer_id, date, content, created_at, updated_at,
                 notion_block_id, is_important`,
      vals
    )

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'conversation 不存在' }, { status: 404 })
    }

    const row = res.rows[0]

    // 編輯內容 → 同步 Notion 內文那行（有存 block id 才同步）。best-effort
    if (hasContent && row.notion_block_id) {
      await updateBodyBlockText(
        row.notion_block_id,
        formatConversationBodyLine(row.date, row.content),
      )
    }

    return NextResponse.json({ conversation: row })
  } catch (err: any) {
    console.error('PATCH /api/conversations/[id] failed:', err?.message || err)
    return NextResponse.json({ error: '更新洽談失敗', detail: err?.message }, { status: 500 })
  }
}

/**
 * DELETE /api/conversations/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 })
    }

    const res = await pool.query(`DELETE FROM conversations WHERE id = $1`, [id])

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'conversation 不存在' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('DELETE /api/conversations/[id] failed:', err?.message || err)
    return NextResponse.json({ error: '刪除洽談失敗', detail: err?.message }, { status: 500 })
  }
}

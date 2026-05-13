import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/mba/db'

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
    const content = (body.content || '').trim()
    if (!content) {
      return NextResponse.json({ error: 'content 不可為空' }, { status: 400 })
    }

    const res = await pool.query(
      `UPDATE conversations
       SET content = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, notion_person_id, date, content, created_at, updated_at`,
      [content, id]
    )

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'conversation 不存在' }, { status: 404 })
    }

    return NextResponse.json({ conversation: res.rows[0] })
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

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/mba/db'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/viewings/[id]
 * 可更新欄位：opinion ('liked'|'disliked'|null)、note
 *
 * 限定只允許 opinion 與 note，避免前端誤送到其他欄位。
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const idNum = parseInt(id, 10)
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const updates: string[] = []
  const values: any[] = []
  let idx = 1

  if (body.opinion !== undefined) {
    const v = body.opinion
    if (v !== null && v !== 'liked' && v !== 'disliked') {
      return NextResponse.json({ error: 'opinion 必須是 liked / disliked / null' }, { status: 400 })
    }
    updates.push(`opinion = $${idx++}`)
    values.push(v)
  }

  if (body.note !== undefined) {
    const v = typeof body.note === 'string' ? body.note.trim() : null
    updates.push(`note = $${idx++}`)
    values.push(v || null)
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: '無可更新欄位' }, { status: 400 })
  }

  values.push(idNum)
  try {
    const res = await pool.query(
      `UPDATE viewings SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, opinion, note`,
      values
    )
    if (res.rowCount === 0) {
      return NextResponse.json({ error: '找不到帶看記錄' }, { status: 404 })
    }
    return NextResponse.json(res.rows[0])
  } catch (err: any) {
    console.error('PATCH viewings failed:', err?.message || err)
    return NextResponse.json(
      { error: '更新帶看失敗', detail: err?.message },
      { status: 500 }
    )
  }
}

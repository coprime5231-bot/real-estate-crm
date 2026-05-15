import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/mba/db'
import notion from '@/lib/notion'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/viewings/[id]
 * 可更新欄位：opinion ('liked'|'disliked'|null)、note
 *
 * 限定只允許 opinion 與 note，避免前端誤送到其他欄位。
 *
 * note 更新且非空 → 同步 append 一行到買方 Notion 內文（best-effort、失敗只 warning）
 *   格式：[M/D 👁 帶看 社區名] 備註內容   （M/D 取帶看日期）
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

  const noteUpdated = body.note !== undefined

  values.push(idNum)
  try {
    const res = await pool.query(
      `UPDATE viewings SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, opinion, note, notion_buyer_id, datetime, community_name, location`,
      values
    )
    if (res.rowCount === 0) {
      return NextResponse.json({ error: '找不到帶看記錄' }, { status: 404 })
    }
    const row = res.rows[0]

    // note 更新且非空 → append 一行到買方 Notion 內文（best-effort）
    let notionWarning: string | null = null
    const noteText = typeof row.note === 'string' ? row.note.trim() : ''
    if (noteUpdated && noteText && row.notion_buyer_id) {
      try {
        const d = new Date(row.datetime)
        const md = isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`
        const place = (row.community_name || '').trim()
        const head = `${md ? md + ' ' : ''}👁 帶看${place ? ' ' + place : ''}`
        const fullText = `[${head}] ${noteText}`
        await notion.blocks.children.append({
          block_id: row.notion_buyer_id,
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: { rich_text: [{ type: 'text', text: { content: fullText } }] },
            },
          ],
        })
      } catch (e: any) {
        console.error('viewings note → Notion append failed:', e?.message || e)
        notionWarning = '已存 PG、Notion 內文寫入失敗'
      }
    }

    return NextResponse.json({
      id: row.id,
      opinion: row.opinion,
      note: row.note,
      ...(notionWarning ? { warning: notionWarning } : {}),
    })
  } catch (err: any) {
    console.error('PATCH viewings failed:', err?.message || err)
    return NextResponse.json(
      { error: '更新帶看失敗', detail: err?.message },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import notion from '@/lib/notion'
import { pool } from '@/lib/mba/db'
import { resolveBothIds } from '@/lib/mba/id-map'

/**
 * POST /api/clients/[id]/quick-log
 * 洽談快速記錄（雙寫）：
 *   1. PG INSERT conversations（必做，失敗則 500）
 *   2. Notion blocks.children.append（best-effort，失敗只 warning）
 *   3. Notion pages.update 日期 +3（best-effort，失敗只 warning）
 *
 * Body: { content: string }  // 若傳了 type 會被忽略，固定記成「洽談」
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const content = (body.content || '').trim()
    if (!content) {
      return NextResponse.json({ error: '內容不可為空' }, { status: 400 })
    }

    // Phase 4.2：input id 可能是 person ID 或 buyer ID、雙向 resolve
    const ids = await resolveBothIds(params.id)
    const buyerPageId = ids.buyerNotionId // 給 Notion API 用
    const personIdForPg = ids.personId // 給 PG INSERT 用

    // Step 1: PG INSERT（必做、Phase 4.5 person-only write）
    let conversation
    try {
      const insertRes = await pool.query(
        `INSERT INTO conversations (notion_person_id, date, content)
         VALUES ($1, CURRENT_DATE, $2)
         RETURNING id, notion_person_id, date, content, created_at, updated_at`,
        [personIdForPg, content]
      )
      conversation = insertRes.rows[0]
    } catch (error: any) {
      console.error('Failed to insert conversation:', error)
      return NextResponse.json(
        { error: '送出失敗，請重試', detail: error?.message },
        { status: 500 }
      )
    }

    // 標題列格式：[M/D 📞 洽談] content
    const now = new Date()
    const timestamp = `${now.getMonth() + 1}/${now.getDate()}`
    const fullText = `[${timestamp} 📞 洽談] ${content}`

    // Step 2: Notion append（容錯）
    let blockId = ''
    let notionAppendFailed = false
    try {
      const blockRes = await notion.blocks.children.append({
        block_id: buyerPageId,
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: fullText } }],
            },
          },
        ],
      })
      blockId = (blockRes.results[0] as any)?.id || ''
    } catch (error: any) {
      console.error('Failed to append block:', error)
      notionAppendFailed = true
    }

    // Step 3: Notion pages.update 日期 +3（容錯）
    const followUpDate = new Date()
    followUpDate.setDate(followUpDate.getDate() + 3)
    const newFollowUp = `${followUpDate.getFullYear()}-${String(followUpDate.getMonth() + 1).padStart(2, '0')}-${String(followUpDate.getDate()).padStart(2, '0')}`

    let dateUpdateFailed = false
    try {
      await notion.pages.update({
        page_id: buyerPageId,
        properties: {
          '日期': { date: { start: newFollowUp } },
        },
      })
    } catch (error: any) {
      console.error('Failed to update follow-up date:', error)
      dateUpdateFailed = true
    }

    const warning = notionAppendFailed
      ? '已記錄（PG），Notion 寫入失敗'
      : dateUpdateFailed
        ? '已記錄但跟進日設定失敗，請手動設定'
        : null

    return NextResponse.json({
      conversation,
      blockId,
      text: fullText,
      newFollowUp: dateUpdateFailed ? null : newFollowUp,
      warning,
    })
  } catch (error: any) {
    console.error('Failed to quick-log:', error)
    return NextResponse.json({ error: '快速記錄失敗', detail: error?.message }, { status: 500 })
  }
}

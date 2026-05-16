import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, extractSelectValue } from '@/lib/notion'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dev/[id]/items
 *
 * 委託頁「案子」(開發 DB 頁) 的重要事項 / 待辦事項。
 * 開發 DB 頁有兩個單向 relation：
 *   - 本周重要大事 → IMPORTANT_DB
 *   - 待辦事項      → TODO_DB
 * 這支讀那兩個 relation 的 id、逐筆 retrieve 回標題/狀態。
 *
 * important：濾掉 優先级=DONE（只回未完成、對齊行銷）
 * todos    ：濾掉 待辦=true（只回未完成 pending）
 */

function titleOf(props: any): string {
  for (const def of Object.values(props || {})) {
    const d = def as any
    if (d?.type === 'title') return d.title?.[0]?.plain_text || '(未命名)'
  }
  return '(未命名)'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const page: any = await notion.pages.retrieve({ page_id: params.id })
    const props = page?.properties || {}

    const importantRel: { id: string }[] = props['本周重要大事']?.relation || []
    const todoRel: { id: string }[] = props['待辦事項']?.relation || []

    const important = (
      await Promise.all(
        importantRel.map(async (r) => {
          try {
            const p: any = await notion.pages.retrieve({ page_id: r.id })
            const status = extractSelectValue(p.properties?.['優先级']?.select) || ''
            if (status === 'DONE') return null
            return { id: p.id, title: titleOf(p.properties) }
          } catch {
            return null
          }
        }),
      )
    ).filter(Boolean)

    const todos = (
      await Promise.all(
        todoRel.map(async (r) => {
          try {
            const p: any = await notion.pages.retrieve({ page_id: r.id })
            const done = p.properties?.['待辦']?.checkbox === true
            if (done) return null
            return { id: p.id, title: titleOf(p.properties) }
          } catch {
            return null
          }
        }),
      )
    ).filter(Boolean)

    return NextResponse.json({ important, todos })
  } catch (err: any) {
    console.error('GET /api/dev/[id]/items failed:', err?.message || err)
    return NextResponse.json(
      { error: '讀取案子重要/待辦失敗', detail: err?.message, important: [], todos: [] },
      { status: 500 },
    )
  }
}

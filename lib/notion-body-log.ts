import notion, { extractText } from '@/lib/notion'

/**
 * 重要事項 / 待辦事項 → 回寫客戶 Notion 頁面內文（body）共用工具。
 *
 * 設計：建立項目時 append 一個 paragraph block 到「關聯客戶頁面」的內文、
 * 把 block id 存回項目頁的「內文BlockID」欄；完成時據此 block id 把那行加刪除線
 * （只劃線、留著當記錄、不移除）。全部 best-effort——失敗只 console.error，
 * 不擋主流程（沿用 quick-log / 帶看 寫回慣例）。
 */

const BODY_BLOCKID_PROP = '內文BlockID'

/** 標題列格式：`[M/D ⭐ 重要] xxx` / `[M/D ☑ 待辦] xxx`（對齊 quick-log `[M/D 📞 洽談]`） */
export function formatBodyLine(kind: '重要' | '待辦', title: string): string {
  const now = new Date()
  const ts = `${now.getMonth() + 1}/${now.getDate()}`
  const icon = kind === '重要' ? '⭐' : '☑'
  return `[${ts} ${icon} ${kind}] ${title}`.trim()
}

/**
 * append 一行 paragraph 到客戶頁面內文。回傳新 block id；失敗回 null（best-effort）。
 */
export async function appendClientBodyLine(
  clientPageId: string,
  text: string,
): Promise<string | null> {
  if (!clientPageId || !text.trim()) return null
  try {
    const res = await notion.blocks.children.append({
      block_id: clientPageId,
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: text } }],
          },
        },
      ],
    })
    return (res.results[0] as any)?.id || null
  } catch (err: any) {
    console.error('[notion-body-log] appendClientBodyLine failed:', err?.message || err)
    return null
  }
}

/**
 * 把項目頁的 block id 寫回「內文BlockID」欄。best-effort。
 */
export async function saveBodyBlockId(
  itemPageId: string,
  blockId: string,
): Promise<void> {
  if (!itemPageId || !blockId) return
  try {
    await notion.pages.update({
      page_id: itemPageId,
      properties: {
        [BODY_BLOCKID_PROP]: { rich_text: [{ type: 'text', text: { content: blockId } }] },
      },
    })
  } catch (err: any) {
    console.error('[notion-body-log] saveBodyBlockId failed:', err?.message || err)
  }
}

/**
 * 讀項目頁的「內文BlockID」。查無回 null。
 */
export async function readBodyBlockId(itemPageId: string): Promise<string | null> {
  try {
    const page: any = await notion.pages.retrieve({ page_id: itemPageId })
    const v = extractText(page?.properties?.[BODY_BLOCKID_PROP]?.rich_text || [])
    return v || null
  } catch (err: any) {
    console.error('[notion-body-log] readBodyBlockId failed:', err?.message || err)
    return null
  }
}

/**
 * 把某 block 的內文加 / 移除刪除線（保留文字、只切 strikethrough 標註）。
 * 只支援會帶 rich_text 的 block（paragraph 等）；append 出來的固定是 paragraph。
 * best-effort。
 */
export async function setBodyBlockStrike(
  blockId: string,
  on: boolean,
): Promise<void> {
  if (!blockId) return
  try {
    const block: any = await notion.blocks.retrieve({ block_id: blockId })
    const type: string = block?.type
    const richText: any[] = block?.[type]?.rich_text
    if (!Array.isArray(richText) || richText.length === 0) return

    const rewritten = richText.map((rt: any) => ({
      type: 'text',
      text: {
        content: rt?.plain_text ?? rt?.text?.content ?? '',
        link: rt?.text?.link ?? null,
      },
      annotations: { ...(rt?.annotations || {}), strikethrough: on },
    }))

    await notion.blocks.update({
      block_id: blockId,
      [type]: { rich_text: rewritten },
    } as any)
  } catch (err: any) {
    console.error('[notion-body-log] setBodyBlockStrike failed:', err?.message || err)
  }
}

/**
 * 完成時呼叫：讀項目頁 內文BlockID → 把該 body 行加 / 移除刪除線。best-effort。
 */
export async function strikeItemBodyLine(
  itemPageId: string,
  on: boolean,
): Promise<void> {
  const blockId = await readBodyBlockId(itemPageId)
  if (!blockId) return
  await setBodyBlockStrike(blockId, on)
}

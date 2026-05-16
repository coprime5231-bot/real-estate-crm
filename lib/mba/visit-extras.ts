import notion, { extractText, extractSelectValue } from '@/lib/notion'

export interface VisitExtras {
  /** 現況 select：空屋 / 自住 */
  occupancy: string | null
  /** 坪數（純數字字串、render 端補「坪」） */
  area: string | null
  /** 開價（純數字字串、render 端補「萬」） */
  price: string | null
  /** 格局（自由文字、如「四房平車」） */
  layout: string | null
  /** 社區網頁 URL */
  web: string | null
}

/**
 * 從 calendar event description 解出 Notion 開發 DB 頁面 id，反查取出物件延伸欄位。
 *
 * CRM `/api/dev/schedule-visit` 建 event 時會在 description 寫一行：
 *   `Notion：https://www.notion.so/{32位hex無dash}`
 * 這裡用同一個 id 反查、欄位對應同 `/api/dev` 的 mapPage（現況/坪數/開價/格局/網頁）。
 *
 * 解不出 id / 舊事件非 CRM 建 / Notion 查詢失敗 → 回 null，呼叫端 graceful degrade
 * （與 [[getViewingByCalendarEventId]] 同模式）。
 */
export async function getVisitExtrasFromDescription(
  description: string | null,
): Promise<VisitExtras | null> {
  if (!description) return null
  const m = description.match(/notion\.so\/([0-9a-fA-F]{32})/)
  if (!m) return null
  const pageId = m[1]

  const page = (await notion.pages.retrieve({ page_id: pageId })) as any
  const props = page?.properties
  if (!props) return null

  const occupancy = extractSelectValue(props['現況']?.select) || null
  const area = extractText(props['坪數']?.rich_text || []) || null
  const price = extractText(props['開價']?.rich_text || []) || null
  const layout = extractText(props['格局']?.rich_text || []) || null
  const web = props['網頁']?.url || null

  // 全空就當沒資料、回 null（render 端不必判 5 個 falsy）
  if (!occupancy && !area && !price && !layout && !web) return null

  return { occupancy, area, price, layout, web }
}

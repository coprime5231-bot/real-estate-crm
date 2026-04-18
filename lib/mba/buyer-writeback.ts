/**
 * 帶看意願 → 回寫買方 Notion page body
 *
 * 從 Calendar event description 抓買方 page UUID，append 一段
 * 「M/D HH:MM 〈社區名〉 覺得不錯 有喜歡」
 * 「M/D HH:MM 〈社區名〉 沒興趣」
 * 到該 page。社區名為空時跳過。
 */

import { extractPageId } from './notion-writeback'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }
}

/**
 * 把 ISO 8601 字串（含 +08:00）轉成 Asia/Taipei 的 M/D HH:MM。
 * 月、日不 pad zero；時、分 pad 2 位。
 * 字串切比 Date parsing 可靠，與 calendar.ts 內 extractTaipeiTime 一致。
 */
export function formatTaipeiMdHm(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return ''
  const month = String(parseInt(m[1], 10))
  const day = String(parseInt(m[2], 10))
  return `${month}/${day} ${m[3]}:${m[4]}`
}

export interface ViewingWritebackOpts {
  interest: 'yes' | 'no'
  communityName: string | null
  eventStartIso: string
}

export async function handleViewingBuyerWriteback(
  description: string | null,
  opts: ViewingWritebackOpts,
): Promise<{ success: boolean; pageId: string | null }> {
  const pageId = extractPageId(description)
  if (!pageId) {
    console.warn('[buyer-writeback] no buyer page_id in description')
    return { success: false, pageId: null }
  }

  const dt = formatTaipeiMdHm(opts.eventStartIso)
  const community = opts.communityName?.trim() ? ` ${opts.communityName.trim()}` : ''
  const tail = opts.interest === 'yes' ? '覺得不錯 有喜歡' : '沒興趣'
  const text = `${dt}${community} ${tail}`

  try {
    const res = await fetch(`${NOTION_API}/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: notionHeaders(),
      body: JSON.stringify({
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: text } }],
            },
          },
        ],
      }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      console.error('[buyer-writeback] Notion error', res.status, err)
      return { success: false, pageId }
    }
    return { success: true, pageId }
  } catch (err) {
    console.error('[buyer-writeback] error', err)
    return { success: false, pageId }
  }
}

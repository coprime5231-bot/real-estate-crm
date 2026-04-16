/**
 * 帶看「有興趣」→ 回寫買方 Notion page body
 *
 * 從 Calendar event description 抓買方 page UUID，
 * append「{M/d HH:mm} - 看了有喜歡 再追」到該 page。
 */

import { extractPageId, taipeiTimestamp } from './notion-writeback'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }
}

export async function handleViewingBuyerWriteback(
  description: string | null,
): Promise<{ success: boolean; pageId: string | null }> {
  const pageId = extractPageId(description)
  if (!pageId) {
    console.warn('[buyer-writeback] no buyer page_id in description')
    return { success: false, pageId: null }
  }

  const text = `${taipeiTimestamp()} - 看了有喜歡 再追`

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

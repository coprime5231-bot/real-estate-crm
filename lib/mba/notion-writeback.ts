/**
 * 拜訪卡片 Notion 寫回
 *
 * 語意表來自 crm skill「拜訪卡片-flow設計.md」的 Flow C 邏輯。
 * Notion DB：新募極限 30156ff9-a859-8087-a9f8-fb20ab3d7c06
 *
 * 順序嚴格遵守：update 待辦 → append body（update 先，觸發 Flow A 閉環）
 */

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

export type VisitEventType =
  | 'visit_property'
  | 'visit_household'
  | 'revisit_property'
  | 'revisit_household'

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }
}

export function classifyVisitEvent(summary: string): VisitEventType {
  const isRevisit = summary.includes('覆訪')
  const isHousehold = summary.includes('戶藉地')
  if (isRevisit && isHousehold) return 'revisit_household'
  if (isRevisit) return 'revisit_property'
  if (isHousehold) return 'visit_household'
  return 'visit_property'
}

export function extractPageId(description: string | null): string | null {
  if (!description) return null
  const matches = description.match(/[a-f0-9]{32}/gi)
  if (!matches?.length) return null
  const hex = matches[matches.length - 1]
  return hex.replace(
    /(.{8})(.{4})(.{4})(.{4})(.{12})/,
    '$1-$2-$3-$4-$5',
  )
}

export function taipeiTimestamp(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${g('month')}/${g('day')} ${g('hour')}:${g('minute')}`
}

async function readHouseholdAddress(pageId: string): Promise<string> {
  try {
    const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
      headers: notionHeaders(),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return (
      data.properties?.['戶藉地址']?.rich_text?.[0]?.plain_text ?? ''
    )
  } catch {
    return ''
  }
}

function computeWriteback(
  etype: VisitEventType,
  action: 'invalid' | 'retry',
  householdAddress: string,
): { newTodo: string; shouldUpdate: boolean; noteText: string } {
  const houseIsSame = householdAddress.trim() === '同'

  if (action === 'invalid') {
    if (etype === 'visit_property' || etype === 'revisit_property') {
      if (houseIsSame) {
        return { newTodo: '', shouldUpdate: false, noteText: '物件地找不到人' }
      }
      return {
        newTodo: '戶藉地拜訪',
        shouldUpdate: true,
        noteText: '物件地找不到人',
      }
    }
    return {
      newTodo: '',
      shouldUpdate: false,
      noteText: '戶藉地找不到人',
    }
  }

  // retry
  if (etype === 'visit_property') {
    return {
      newTodo: '物件地覆訪',
      shouldUpdate: true,
      noteText: '物件地人不在',
    }
  }
  if (etype === 'revisit_property') {
    return {
      newTodo: '物件地覆訪',
      shouldUpdate: true,
      noteText: '物件地人不在，再找找',
    }
  }
  if (etype === 'visit_household') {
    return {
      newTodo: '戶藉地覆訪',
      shouldUpdate: true,
      noteText: '戶藉地人不在',
    }
  }
  return {
    newTodo: '戶藉地覆訪',
    shouldUpdate: true,
    noteText: '戶藉地人不在，再找找',
  }
}

async function updateNotionTodo(
  pageId: string,
  newTodo: string,
): Promise<void> {
  await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders(),
    body: JSON.stringify({
      properties: {
        '待辦': { select: { name: newTodo } },
        '已同步': { select: null },
      },
    }),
  })
}

async function appendNotionBlock(
  pageId: string,
  text: string,
): Promise<void> {
  await fetch(`${NOTION_API}/blocks/${pageId}/children`, {
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
}

export async function handleVisitWriteback(params: {
  summary: string
  description: string | null
  action: 'invalid' | 'retry'
}): Promise<{
  success: boolean
  noteText: string
  pageId: string | null
}> {
  const pageId = extractPageId(params.description)
  if (!pageId) {
    console.warn('[notion-writeback] no page_id in description')
    return { success: false, noteText: '', pageId: null }
  }

  const etype = classifyVisitEvent(params.summary)

  let householdAddress = ''
  if (
    params.action === 'invalid' &&
    (etype === 'visit_property' || etype === 'revisit_property')
  ) {
    householdAddress = await readHouseholdAddress(pageId)
  }

  const result = computeWriteback(etype, params.action, householdAddress)
  const fullNote = `${taipeiTimestamp()} - ${result.noteText}`

  try {
    if (result.shouldUpdate) {
      await updateNotionTodo(pageId, result.newTodo)
    }
    await appendNotionBlock(pageId, fullNote)
    return { success: true, noteText: fullNote, pageId }
  } catch (err) {
    console.error('[notion-writeback] error', err)
    return { success: false, noteText: fullNote, pageId }
  }
}

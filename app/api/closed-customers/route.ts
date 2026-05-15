import { NextResponse } from 'next/server'
import notion, { extractText, queryDatabaseAll } from '@/lib/notion'

export const dynamic = 'force-dynamic'

/**
 * GET /api/closed-customers
 *
 * 成交客戶 = 開發 DB + 行銷(買方) DB 中、「成交客」select = 「是」的記錄、合併回傳。
 * 回傳 shape 對齊前端 DevProperty（缺的欄位給 undefined），加 source 標記來源。
 */

const CLOSED_FILTER = { property: '成交客', select: { equals: '是' } }

function mapDev(p: any) {
  const props = p.properties || {}
  return {
    id: p.id,
    name: props['名稱']?.title?.[0]?.plain_text || '(未命名)',
    owner: extractText(props['屋主']?.rich_text || []) || undefined,
    address: extractText(props['物件地址']?.rich_text || []) || undefined,
    householdAddress: extractText(props['戶藉地址']?.rich_text || []) || undefined,
    ownerPhone: props['手機']?.phone_number || undefined,
    price: extractText(props['開價']?.rich_text || []) || undefined,
    closingDate: props['成交日期']?.date?.start ?? null,
    devProgress: [] as string[],
    source: 'dev' as const,
  }
}

function mapBuyer(p: any) {
  const props = p.properties || {}
  return {
    id: p.id,
    name: props['名稱']?.title?.[0]?.plain_text || '(未命名)',
    owner: undefined,
    address: undefined,
    householdAddress: undefined,
    ownerPhone: props['手機']?.phone_number || undefined,
    price: undefined,
    closingDate: props['成交日期']?.date?.start ?? null,
    devProgress: [] as string[],
    source: 'buyer' as const,
  }
}

export async function GET() {
  try {
    const devDb = process.env.NOTION_DEV_DB_ID
    const buyerDb = process.env.NOTION_BUYER_DB_ID
    if (!devDb || !buyerDb) {
      return NextResponse.json({ error: '未配置 NOTION_DEV_DB_ID / NOTION_BUYER_DB_ID' }, { status: 400 })
    }

    const [devPages, buyerPages] = await Promise.all([
      queryDatabaseAll(devDb, CLOSED_FILTER),
      queryDatabaseAll(buyerDb, CLOSED_FILTER),
    ])

    const data = [
      ...devPages.filter((p: any) => p.object === 'page').map(mapDev),
      ...buyerPages.filter((p: any) => p.object === 'page').map(mapBuyer),
    ]
    // 成交日期新→舊
    data.sort((a, b) => {
      const da = a.closingDate ? new Date(a.closingDate).getTime() : 0
      const db = b.closingDate ? new Date(b.closingDate).getTime() : 0
      return db - da
    })

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('GET /api/closed-customers failed:', err?.message || err)
    return NextResponse.json({ error: '無法獲取成交客戶', detail: err?.message }, { status: 500 })
  }
}

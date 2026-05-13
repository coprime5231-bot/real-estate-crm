/**
 * POST /api/labels
 * Body: { propertyIds: string[] }
 *
 * 從 Notion 開發 DB 撈每筆 property 的 物件地址 / 戶藉地址 / 屋主、
 * 展開成 label 列表（戶藉地與物件地不同則 +1 張）、用同模板格式
 * 產生多頁 .docx 回傳。
 */

import { NextRequest, NextResponse } from 'next/server'
import notion, { extractText, extractSelectValue } from '@/lib/notion'
import { buildLabelsDocx, type Label } from '@/lib/labels/build-docx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SAME_MARKERS = ['同', '同上', '同物件地址', '同物件', '同地址']

function normalize(s: string | undefined | null): string {
  return (s || '').replace(/\s+/g, '').trim()
}

function isSameAsObject(household: string | undefined, address: string | undefined): boolean {
  const h = normalize(household)
  if (!h) return true
  if (SAME_MARKERS.includes(h)) return true
  if (h === normalize(address)) return true
  return false
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const propertyIds: string[] = Array.isArray(body?.propertyIds) ? body.propertyIds : []
    if (propertyIds.length === 0) {
      return NextResponse.json({ error: '請至少勾選一筆' }, { status: 400 })
    }

    // 一次抓所有 Notion page（並行）
    const pages = await Promise.all(
      propertyIds.map((id) => notion.pages.retrieve({ page_id: id }).catch(() => null))
    )

    // 直接從 Notion「物件地址」「戶藉地址」欄位產 label、letter 不參與
    const labels: Label[] = []
    for (const p of pages) {
      if (!p) continue
      const props: any = (p as any).properties || {}
      const owner = extractText(props['屋主']?.rich_text || []) || ''
      const address = (extractText(props['物件地址']?.rich_text || []) || '').trim()
      let household = (extractText(props['戶藉地址']?.rich_text || []) || '').trim()
      if (SAME_MARKERS.includes(household)) household = ''
      const name = `${owner} 親啟`.trim()

      if (address) {
        labels.push({ address, name })
      }
      if (household && household.replace(/\s+/g, '') !== address.replace(/\s+/g, '')) {
        labels.push({ address: household, name })
      }
    }

    if (labels.length === 0) {
      return NextResponse.json({ error: '勾選的物件都沒有地址' }, { status: 400 })
    }

    const buf = buildLabelsDocx(labels)
    // YYMMDD_HHMM_開發信標籤.docx (Asia/Taipei)
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
    const fname = `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}_開發信標籤.docx`
    const encodedFname = encodeURIComponent(fname)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="labels.docx"; filename*=UTF-8''${encodedFname}`,
        'X-Label-Count': String(labels.length),
      },
    })
  } catch (err: any) {
    console.error('POST /api/labels failed:', err?.message || err)
    return NextResponse.json({ error: '產生標籤失敗', detail: err?.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import {
  PersonData,
  extractText,
  extractSelectValue,
  extractMultiSelectNames,
  queryDatabaseAll,
} from '@/lib/notion'

/**
 * GET /api/people
 *   ?role=買方 | 屋主 | 潛在屋主 | 成交客戶  (optional 過濾)
 *
 * 讀 NOTION_PERSON_DB_ID（新 schema、Phase 2）
 */
export async function GET(request: NextRequest) {
  try {
    const dbId = process.env.NOTION_PERSON_DB_ID
    if (!dbId) {
      return NextResponse.json({ error: '未配置 NOTION_PERSON_DB_ID' }, { status: 400 })
    }

    const role = request.nextUrl.searchParams.get('role')
    const filter = role
      ? {
          property: '角色',
          multi_select: { contains: role },
        }
      : undefined

    const pages = await queryDatabaseAll(dbId, filter)

    const people: PersonData[] = pages
      .filter((p: any) => p.object === 'page')
      .map((p: any) => {
        const props = p.properties
        return {
          id: p.id,
          name: props['名稱']?.title?.[0]?.plain_text || '(未命名)',
          phone: props['手機']?.phone_number || undefined,
          idNumber: extractText(props['身份證字號']?.rich_text || []) || undefined,
          birthday: props['生日']?.date?.start ?? null,
          roles: extractMultiSelectNames(props['角色']),
          grade: (extractSelectValue(props['客戶等級']?.select) || undefined) as PersonData['grade'],
          zones: extractMultiSelectNames(props['區域偏好']),
          source: extractSelectValue(props['來源']?.select) || undefined,
          note: extractText(props['NOTE']?.rich_text || []),
          progress: extractText(props['最近進展']?.rich_text || []),
          nextFollowUp: props['下次跟進']?.date?.start,
        }
      })

    return NextResponse.json(people)
  } catch (err: any) {
    console.error('Failed to fetch people:', err)
    return NextResponse.json(
      { error: '無法獲取人物資料', detail: err?.message },
      { status: 500 }
    )
  }
}

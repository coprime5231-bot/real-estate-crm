import { Client } from '@notionhq/client'

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
})

export default notion

export interface BuyerData {
  id: string
  name: string
  phone?: string
  note?: string
  progress?: string
  grade?: 'A級' | 'B級' | 'C級'
  source?: string
  budget?: string
  needs?: string
  area?: string
  nextFollowUp?: string
  birthday?: string | null
}

export interface PropertyData {
  id: string
  title: string
  address?: string
  price?: string
  status?: string
}

export interface TodoData {
  id: string
  title: string
  completed: boolean
  buyerId?: string
}

export interface WeeklyData {
  id: string
  week: string
  showing?: number
  progress?: string
}

export interface VideoData {
  id: string
  title: string
  status: 'planning' | 'filming' | 'published'
  viewCount?: number
}

export interface AIProjectData {
  id: string
  title: string
  status: 'idea' | 'building' | 'done'
  platforms?: string[]
}

// === New schema (Phase 2, 2026-05-12) ===
// 人物 / 物件 / 買方需求 三層結構、跟舊 BuyerData/PropertyData 並存
// 舊 routes (/api/clients、/api/properties) 仍指向舊 DB、雙軌期 ≥ 2 週

export interface PersonData {
  id: string
  name: string
  phone?: string
  idNumber?: string
  birthday?: string | null
  roles: string[] // 買方 / 屋主 / 潛在屋主 / 成交客戶（可多選）
  grade?: 'A級' | 'B級' | 'C級' | 'D級' | '未接'
  zones: string[]
  source?: string
  note?: string
  progress?: string
  nextFollowUp?: string
}

export type PropertyStatus = '開發信' | '追蹤' | '委託' | '過期' | '成交'
export type VisitTodo = '物件地拜訪' | '戶藉地拜訪' | '物件地覆訪' | '戶藉地覆訪'

export interface PropertyV2Data {
  id: string
  name: string
  address?: string
  householdAddress?: string
  ownerIds: string[]
  status?: PropertyStatus
  devLetter?: boolean
  devProgress: string[]
  visitTodo?: VisitTodo
  visitSynced?: VisitTodo
  area?: string
  mainBuilding?: string
  layout?: string
  parking: string[]
  price?: string
  objectLetter?: string
  householdLetter?: string
  expiry?: string | null
  important?: string
  web?: string
}

export type BuyerNeedStatus = '配案中' | '已成交' | '暫停' | '放棄'

export interface BuyerNeedData {
  id: string
  name: string
  clientId?: string
  status?: BuyerNeedStatus
  budget?: string
  zones: string[]
  layouts: string[]
  needTags: string[]
  needText?: string
  note?: string
  progress?: string
  matchedPropertyIds: string[]
  viewedPropertyIds: string[]
}

// === Helpers ===

export function extractMultiSelectNames(prop: any): string[] {
  if (!prop?.multi_select) return []
  return prop.multi_select.map((o: any) => o.name).filter(Boolean)
}

export function extractRelationIds(prop: any): string[] {
  if (!prop?.relation) return []
  return prop.relation.map((r: any) => r.id).filter(Boolean)
}

/**
 * 分頁讀完一個 DB 全部 page（Notion API 上限 100/page）
 */
export async function queryDatabaseAll(databaseId: string, filter?: any): Promise<any[]> {
  const results: any[] = []
  let cursor: string | undefined = undefined
  do {
    const res: any = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
      ...(filter ? { filter } : {}),
    })
    results.push(...res.results)
    cursor = res.has_more ? res.next_cursor : undefined
  } while (cursor)
  return results
}

export const extractText = (richText: any[]): string => {
  if (!richText || !Array.isArray(richText)) return ''
  return richText.map((block: any) => block.plain_text).join('')
}

export const extractSelectValue = (select: any): string => {
  if (!select) return ''
  return select.name || ''
}

export const formatDate = (dateString?: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export const daysUntil = (dateString?: string): number => {
  if (!dateString) return Infinity
  const target = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export const isOverdue = (dateString?: string): boolean => {
  return daysUntil(dateString) < 0
}

// === Mutation builders (Phase 3、寫回新 schema 用) ===

export const propTitle = (text?: string) =>
  text === undefined ? undefined : { title: [{ text: { content: text } }] }

export const propRichText = (text?: string) =>
  text === undefined ? undefined : { rich_text: text ? [{ text: { content: text } }] : [] }

export const propPhone = (phone?: string) =>
  phone === undefined ? undefined : { phone_number: phone || null }

export const propUrl = (url?: string) =>
  url === undefined ? undefined : { url: url || null }

export const propCheckbox = (val?: boolean) =>
  val === undefined ? undefined : { checkbox: !!val }

export const propSelect = (name?: string | null) => {
  if (name === undefined) return undefined
  return { select: name ? { name } : null }
}

export const propMultiSelect = (names?: string[]) =>
  names === undefined ? undefined : { multi_select: (names || []).map((n) => ({ name: n })) }

export const propDate = (iso?: string | null) => {
  if (iso === undefined) return undefined
  return { date: iso ? { start: iso } : null }
}

export const propRelation = (ids?: string[]) =>
  ids === undefined ? undefined : { relation: (ids || []).map((id) => ({ id })) }

/** 去掉 undefined key，避免送空欄位給 Notion API */
export function compactProps(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

export async function createNotionPage(databaseId: string, properties: Record<string, any>) {
  return notion.pages.create({
    parent: { database_id: databaseId },
    properties: properties as any,
  })
}

export async function updateNotionPage(pageId: string, properties: Record<string, any>) {
  return notion.pages.update({
    page_id: pageId,
    properties: properties as any,
  })
}

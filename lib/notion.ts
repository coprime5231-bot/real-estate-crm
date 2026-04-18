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

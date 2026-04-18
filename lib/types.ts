export type Grade = 'A級' | 'B級' | 'C級'

export type SLAStatus = 'normal' | 'warning' | 'frozen'

export interface Client {
  id: string
  name: string
  phone?: string
  note?: string
  progress?: string
  grade?: Grade
  source?: string
  budget?: string
  needs?: string
  area?: string
  nextFollowUp?: string
  birthday?: string | null
  needTags?: string[]
  todoIds?: string[]
  slaStatus?: SLAStatus
  daysSinceEdit?: number
  hasNextStep?: boolean
  textId?: string | null
}

export interface Property {
  id: string
  title: string
  address?: string
  price?: string
  status?: string
}

export interface Todo {
  id: string
  title: string
  completed: boolean
  clientId?: string
}

export interface Weekly {
  id: string
  week: string
  showing?: number
  progress?: string
}

export interface VideoIdea {
  id: string
  title: string
  status: 'planning' | 'filming' | 'published'
  viewCount?: number
}

export interface AIProject {
  id: string
  title: string
  status: 'idea' | 'building' | 'done'
  platforms?: string[]
}

export interface SetupStatus {
  configured: boolean
  missingIds: string[]
  lastChecked: string
}

export interface ImportantItem {
  id: string
  title: string
  clientName: string
  clientId: string
  source: 'buyer' | 'tracking'
}

export interface TodoItem {
  id: string
  title: string
  clientName: string
  clientId: string
  source: 'buyer' | 'tracking'
  completed: boolean
  createdTime: string
}

export interface Block {
  id: string
  text: string
  createdTime: string
}

export interface Community {
  id: number
  name: string
  leju_url: string | null
}

export type ViewingOpinion = 'liked' | 'disliked' | null

export interface Viewing {
  id: number
  calendar_event_id: string
  notion_buyer_id: string
  datetime: string
  location: string
  community_name: string | null
  community_url: string | null
  community_leju_url: string | null
  colleague_name: string
  colleague_phone: string
  note: string | null
  opinion: ViewingOpinion
  created_at: string
}

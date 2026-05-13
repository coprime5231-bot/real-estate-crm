'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Phone,
  AlertTriangle,
  Flame,
  XCircle,
  Mail,
  Loader2,
  MapPin,
  ChevronRight,
} from 'lucide-react'

type Opinion = 'liked' | 'disliked' | null

interface ViewingToday {
  id: number
  notion_buyer_id: string | null
  datetime: string
  location: string
  community_name: string | null
  colleague_name: string
  colleague_phone: string
  opinion: Opinion
}

interface BuyerFollowUp {
  id: string
  name: string
  grade?: string
  phone?: string
  area?: string
  budget?: string
  progress?: string
  nextFollowUp: string
  daysOverdue: number
}

interface DevExpiring {
  id: string
  name: string
  owner?: string
  ownerPhone?: string
  address?: string
  expiry: string
  daysUntilExpiry: number
  important?: string
}

interface DevLetterPending {
  id: string
  name: string
  owner?: string
  address?: string
}

interface TodayDashboard {
  date: string
  viewingsToday: ViewingToday[]
  followUpsDue: BuyerFollowUp[]
  followUpsOverdue: BuyerFollowUp[]
  entrustExpiring: DevExpiring[]
  entrustExpired: DevExpiring[]
  devLettersPending: { count: number; preview: DevLetterPending[] }
}

// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso))
  } catch {
    return iso.slice(11, 16)
  }
}

function formatHeaderDate(yyyymmdd: string): string {
  // 2026-05-13 → 2026 年 5 月 13 日（週 X）
  const d = new Date(yyyymmdd + 'T00:00:00+08:00')
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${yyyymmdd}（週${week}）`
}

function gradeColor(g?: string) {
  switch (g) {
    case 'A級': return 'text-rose-300 bg-rose-950/40 border-rose-900/50'
    case 'B級': return 'text-amber-300 bg-amber-950/40 border-amber-900/50'
    case 'C級': return 'text-sky-300 bg-sky-950/40 border-sky-900/50'
    default: return 'text-slate-300 bg-slate-800/60 border-slate-700'
  }
}

// ---------------------------------------------------------------------------

function Section({
  icon,
  title,
  count,
  tone = 'neutral',
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  tone?: 'neutral' | 'warn' | 'danger' | 'good'
  children: React.ReactNode
}) {
  if (count === 0) return null
  const toneClass = tone === 'danger'
    ? 'border-rose-900/50 bg-rose-950/20'
    : tone === 'warn'
    ? 'border-amber-900/50 bg-amber-950/20'
    : tone === 'good'
    ? 'border-emerald-900/50 bg-emerald-950/20'
    : 'border-slate-800 bg-slate-900/40'
  return (
    <section className={`border ${toneClass} rounded-lg p-3 mb-3`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h2 className="text-sm font-medium text-white">{title}</h2>
        <span className="text-xs text-slate-400">({count})</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

function ViewingRow({ v }: { v: ViewingToday }) {
  return (
    <div className="flex items-start gap-3 text-sm bg-slate-900/60 rounded px-2.5 py-2">
      <div className="text-indigo-300 font-mono text-xs pt-0.5 shrink-0 w-12">{formatTime(v.datetime)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white truncate">
          {v.community_name || v.location}
          {v.opinion === 'liked' && <span className="ml-1.5 text-[10px] px-1 rounded bg-emerald-900/60 text-emerald-300">有興趣</span>}
          {v.opinion === 'disliked' && <span className="ml-1.5 text-[10px] px-1 rounded bg-slate-700 text-slate-400">沒興趣</span>}
        </div>
        <div className="text-xs text-slate-400 mt-0.5 truncate">
          📍 {v.location}
          <span className="ml-3 text-slate-500">{v.colleague_name} {v.colleague_phone}</span>
        </div>
      </div>
    </div>
  )
}

function FollowUpRow({ b }: { b: BuyerFollowUp }) {
  return (
    <Link
      href="/marketing"
      className="flex items-start gap-2 text-sm bg-slate-900/60 hover:bg-slate-800/70 transition-colors rounded px-2.5 py-2"
    >
      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${gradeColor(b.grade)} shrink-0`}>
        {b.grade || '未'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-white truncate">
          {b.name}
          {b.daysOverdue > 0 && (
            <span className="ml-2 text-xs text-rose-300">逾期 {b.daysOverdue} 天</span>
          )}
        </div>
        {b.progress && (
          <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{b.progress}</div>
        )}
        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
          {b.phone && <span><Phone size={9} className="inline" /> {b.phone}</span>}
          {b.budget && <span>預算 {b.budget}</span>}
          {b.area && <span>{b.area}</span>}
        </div>
      </div>
      <ChevronRight size={14} className="text-slate-500 shrink-0 mt-1" />
    </Link>
  )
}

function ExpiringRow({ d, danger }: { d: DevExpiring; danger?: boolean }) {
  return (
    <Link
      href="/entrust"
      className="flex items-start gap-2 text-sm bg-slate-900/60 hover:bg-slate-800/70 transition-colors rounded px-2.5 py-2"
    >
      <div className="flex-1 min-w-0">
        <div className="text-white truncate">
          {d.name}
          <span className={`ml-2 text-xs ${danger ? 'text-rose-300' : 'text-amber-300'}`}>
            {d.daysUntilExpiry < 0
              ? `過期 ${Math.abs(d.daysUntilExpiry)} 天`
              : d.daysUntilExpiry === 0
              ? '今天到期'
              : `${d.daysUntilExpiry} 天後到期`}
          </span>
        </div>
        {d.address && (
          <div className="text-xs text-slate-400 mt-0.5 truncate flex items-center gap-1">
            <MapPin size={10} /> {d.address}
          </div>
        )}
        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
          {d.owner && <span>屋主 {d.owner}</span>}
          {d.ownerPhone && <span><Phone size={9} className="inline" /> {d.ownerPhone}</span>}
          <span>到期 {d.expiry}</span>
        </div>
        {d.important && (
          <div className="text-[11px] text-amber-300/80 mt-1">⚠ {d.important}</div>
        )}
      </div>
      <ChevronRight size={14} className="text-slate-500 shrink-0 mt-1" />
    </Link>
  )
}

function DevLetterRow({ d }: { d: DevLetterPending }) {
  return (
    <Link
      href="/entrust"
      className="flex items-start gap-2 text-sm bg-slate-900/60 hover:bg-slate-800/70 transition-colors rounded px-2.5 py-2"
    >
      <div className="flex-1 min-w-0">
        <div className="text-white truncate">{d.name}</div>
        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
          {d.owner && <span>屋主 {d.owner}</span>}
          {d.address && <span className="truncate">{d.address}</span>}
        </div>
      </div>
      <ChevronRight size={14} className="text-slate-500 shrink-0 mt-1" />
    </Link>
  )
}

// ---------------------------------------------------------------------------

export default function TodayPage() {
  const [data, setData] = useState<TodayDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/today')
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch (e: any) {
      setError(e?.message || '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalItems =
    (data?.viewingsToday.length || 0) +
    (data?.followUpsDue.length || 0) +
    (data?.followUpsOverdue.length || 0) +
    (data?.entrustExpiring.length || 0) +
    (data?.entrustExpired.length || 0) +
    (data?.devLettersPending.count || 0)

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold">今天</h1>
            {data && (
              <div className="text-xs text-slate-400 mt-0.5">{formatHeaderDate(data.date)}</div>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-700 disabled:opacity-50"
          >
            {loading ? '載入中…' : '↻ 重新整理'}
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 text-sm">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="animate-spin" size={20} />
          </div>
        )}

        {data && totalItems === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">🌤</div>
            <div className="text-sm">今天沒有待辦、清爽</div>
          </div>
        )}

        {data && (
          <>
            <Section
              icon={<Calendar size={16} className="text-indigo-400" />}
              title="今日帶看"
              count={data.viewingsToday.length}
              tone="good"
            >
              {data.viewingsToday.map((v) => (
                <ViewingRow key={v.id} v={v} />
              ))}
            </Section>

            <Section
              icon={<Phone size={16} className="text-sky-400" />}
              title="今日該回的客戶"
              count={data.followUpsDue.length}
            >
              {data.followUpsDue.map((b) => (
                <FollowUpRow key={b.id} b={b} />
              ))}
            </Section>

            <Section
              icon={<AlertTriangle size={16} className="text-amber-400" />}
              title="逾期未回客戶"
              count={data.followUpsOverdue.length}
              tone="warn"
            >
              {data.followUpsOverdue.map((b) => (
                <FollowUpRow key={b.id} b={b} />
              ))}
            </Section>

            <Section
              icon={<XCircle size={16} className="text-rose-400" />}
              title="委託已過期"
              count={data.entrustExpired.length}
              tone="danger"
            >
              {data.entrustExpired.map((d) => (
                <ExpiringRow key={d.id} d={d} danger />
              ))}
            </Section>

            <Section
              icon={<Flame size={16} className="text-amber-400" />}
              title="委託快過期 (7 天內)"
              count={data.entrustExpiring.length}
              tone="warn"
            >
              {data.entrustExpiring.map((d) => (
                <ExpiringRow key={d.id} d={d} />
              ))}
            </Section>

            <Section
              icon={<Mail size={16} className="text-slate-400" />}
              title="待寄開發信"
              count={data.devLettersPending.count}
            >
              {data.devLettersPending.preview.map((d) => (
                <DevLetterRow key={d.id} d={d} />
              ))}
              {data.devLettersPending.count > data.devLettersPending.preview.length && (
                <Link
                  href="/entrust"
                  className="block text-center text-xs text-slate-400 hover:text-white py-1.5"
                >
                  還有 {data.devLettersPending.count - data.devLettersPending.preview.length} 個 → 開發頁
                </Link>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

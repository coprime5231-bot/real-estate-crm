'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FileText,
  Send,
  Eye,
  CheckSquare,
  Square,
  ArrowRight,
  Loader2,
  AlertCircle,
  Calendar,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'

// 跟 /api/dev/route.ts 對齊（不 import、避免 server-only 牽連）
type DevStatus = '募集' | '追蹤' | '委託' | '成交' | '過期'

interface DevProperty {
  id: string
  name: string
  owner?: string
  address?: string
  status?: DevStatus
  closingDate?: string | null
  expiry?: string | null
  important?: string
  ownerPhone?: string
  price?: string
  devLetter?: boolean
  devProgress: string[]
}

type Tab = '開發信' | '追蹤' | '委託'
type DevLetterFilter = 'pending' | 'sent'

// UI tab label ↔ Notion status select value
const TAB_TO_STATUS: Record<Tab, DevStatus> = {
  '開發信': '募集',
  '追蹤': '追蹤',
  '委託': '委託',
}
const NEXT_TAB: Partial<Record<Tab, Tab>> = {
  '開發信': '追蹤',
  '追蹤': '委託',
}

function PropertyRow({
  prop,
  tab,
  onPatch,
  onPromote,
  pending,
}: {
  prop: DevProperty
  tab: Tab
  onPatch: (id: string, patch: Partial<DevProperty>) => Promise<void>
  onPromote: (id: string, next: Tab) => Promise<void>
  pending: boolean
}) {
  const next = NEXT_TAB[tab]
  const expired = prop.expiry ? new Date(prop.expiry).getTime() < Date.now() : false

  return (
    <div className="border border-slate-700 bg-slate-900/60 rounded-lg p-3 mb-2 hover:border-slate-500 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white truncate">{prop.name}</span>
            {prop.price && <span className="text-amber-400 text-sm">{prop.price}</span>}
            {expired && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-300">已過期</span>
            )}
          </div>
          {prop.address && (
            <div className="text-xs text-slate-400 mt-0.5 truncate">📍 {prop.address}</div>
          )}
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
            {prop.owner && <span>屋主：{prop.owner}</span>}
            {prop.ownerPhone && (
              <span className="flex items-center gap-1 text-slate-500">
                <Phone size={11} /> {prop.ownerPhone}
              </span>
            )}
            {prop.expiry && (
              <span className="flex items-center gap-1 text-slate-500">
                <Calendar size={11} /> {prop.expiry}
              </span>
            )}
          </div>
          {tab === '追蹤' && prop.devProgress.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {prop.devProgress.map((p) => (
                <span
                  key={p}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
          {tab === '委託' && prop.important && (
            <div className="mt-1 text-xs text-amber-300/80 bg-amber-950/30 border border-amber-900/40 rounded px-2 py-1">
              ⚠ {prop.important}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tab === '開發信' && (
            <button
              onClick={() => onPatch(prop.id, { devLetter: !prop.devLetter })}
              disabled={pending}
              className={`p-1.5 rounded transition-colors ${
                prop.devLetter
                  ? 'text-emerald-400 hover:text-emerald-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title={prop.devLetter ? '已寄、點擊取消' : '未寄、點擊標記已寄'}
            >
              {prop.devLetter ? <CheckSquare size={18} /> : <Square size={18} />}
            </button>
          )}
          {next && (
            <button
              onClick={() => onPromote(prop.id, next)}
              disabled={pending}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-indigo-700/60 hover:bg-indigo-600 text-indigo-100 transition-colors disabled:opacity-50"
              title={`升級到「${next}」`}
            >
              <ArrowRight size={12} />
              {next}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EntrustPage() {
  const [tab, setTab] = useState<Tab>('開發信')
  const [devLetterFilter, setDevLetterFilter] = useState<DevLetterFilter>('pending')
  const [properties, setProperties] = useState<DevProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dev?activeOnly=1')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as DevProperty[]
      setProperties(data)
    } catch (e: any) {
      setError(e?.message || '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = useMemo(() => {
    const want = TAB_TO_STATUS[tab]
    let list = properties.filter((p) => p.status === want)
    if (tab === '開發信') {
      list = list.filter((p) =>
        devLetterFilter === 'sent' ? p.devLetter === true : !p.devLetter
      )
    }
    return list
  }, [properties, tab, devLetterFilter])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { '開發信': 0, '追蹤': 0, '委託': 0 }
    for (const p of properties) {
      for (const t of Object.keys(TAB_TO_STATUS) as Tab[]) {
        if (p.status === TAB_TO_STATUS[t]) c[t]++
      }
    }
    return c
  }, [properties])

  const patchProperty = useCallback(
    async (id: string, patch: Partial<DevProperty>) => {
      setPendingId(id)
      try {
        const apiPatch: any = {}
        if (patch.devLetter !== undefined) apiPatch.devLetter = patch.devLetter
        if (patch.status !== undefined) apiPatch.status = patch.status
        if (patch.closingDate !== undefined) apiPatch.closingDate = patch.closingDate
        if (patch.expiry !== undefined) apiPatch.expiry = patch.expiry
        if (patch.important !== undefined) apiPatch.important = patch.important

        const res = await fetch('/api/dev', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...apiPatch }),
        })
        if (!res.ok) throw new Error(`PATCH ${res.status}`)
        setProperties((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
        )
      } catch (e: any) {
        toast.error(`更新失敗：${e?.message || e}`)
      } finally {
        setPendingId(null)
      }
    },
    []
  )

  const promote = useCallback(
    async (id: string, next: Tab) => {
      await patchProperty(id, { status: TAB_TO_STATUS[next] })
      toast.success(`已升級到「${next}」`)
    },
    [patchProperty]
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <FileText className="text-indigo-400" size={26} />
          <h1 className="text-xl font-bold">開發</h1>
          <button
            onClick={loadData}
            disabled={loading}
            className="ml-auto text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-700 disabled:opacity-50"
          >
            {loading ? '載入中…' : '↻ 重新整理'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-800">
          {(Object.keys(TAB_TO_STATUS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                tab === t
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t}
              <span className="ml-1.5 text-xs text-slate-500">{counts[t]}</span>
            </button>
          ))}
        </div>

        {/* 開發信 sub-filter */}
        {tab === '開發信' && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setDevLetterFilter('pending')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded border transition-colors ${
                devLetterFilter === 'pending'
                  ? 'border-indigo-500 bg-indigo-950/50 text-indigo-200'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Send size={12} /> 待寄
            </button>
            <button
              onClick={() => setDevLetterFilter('sent')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded border transition-colors ${
                devLetterFilter === 'sent'
                  ? 'border-emerald-600 bg-emerald-950/40 text-emerald-200'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={12} /> 已寄留底
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 text-sm">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            目前沒有「{tab}{tab === '開發信' ? (devLetterFilter === 'sent' ? '・已寄' : '・待寄') : ''}」物件
          </div>
        ) : (
          <div>
            {filtered.map((p) => (
              <PropertyRow
                key={p.id}
                prop={p}
                tab={tab}
                onPatch={patchProperty}
                onPromote={promote}
                pending={pendingId === p.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

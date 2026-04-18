'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink } from 'lucide-react'
import type { Viewing, ViewingOpinion } from '@/lib/types'

interface Props {
  viewing: Viewing
  onUpdate: (patch: Partial<Viewing>) => void
}

// 樓層 regex：match「3樓 / 三樓 / 12樓」放在 location 尾段附近
const FLOOR_RE = /(\d+|[一二三四五六七八九十百]+)\s*樓/

function parseFloor(location: string | null | undefined): string | null {
  if (!location) return null
  const m = location.match(FLOOR_RE)
  if (!m) return null
  return `${m[1]}樓`
}

function formatMonthDay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function ViewingCard({ viewing, onUpdate }: Props) {
  const [toggling, setToggling] = useState<'liked' | 'disliked' | null>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(viewing.note || '')
  const [savingNote, setSavingNote] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setNoteDraft(viewing.note || '')
    setEditingNote(false)
  }, [viewing.id, viewing.note])

  useEffect(() => {
    if (editingNote) noteRef.current?.focus()
  }, [editingNote])

  const floor = parseFloor(viewing.location)
  const communityUrl = viewing.community_url || viewing.community_leju_url || null

  const titleParts: string[] = []
  if (viewing.community_name) {
    titleParts.push(viewing.community_name + (floor ? ` ${floor}` : ''))
  } else if (viewing.location) {
    // fallback：location 本身（太長截短）
    const short = viewing.location.length > 18 ? viewing.location.slice(0, 18) + '…' : viewing.location
    titleParts.push(short)
  } else {
    titleParts.push('帶看')
  }
  const titleText = titleParts.join(' ')

  const handleToggle = async (target: 'liked' | 'disliked') => {
    if (toggling) return
    const current = viewing.opinion
    const next: ViewingOpinion = current === target ? null : target
    setToggling(target)
    try {
      const res = await fetch(`/api/viewings/${viewing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opinion: next }),
      })
      if (!res.ok) throw new Error('PATCH failed')
      onUpdate({ opinion: next })
    } catch (err: any) {
      console.error('toggle opinion failed:', err)
      toast.error('切換失敗')
    } finally {
      setToggling(null)
    }
  }

  const handleSaveNote = async () => {
    const val = noteDraft.trim()
    if (val === (viewing.note || '').trim()) {
      setEditingNote(false)
      return
    }
    setSavingNote(true)
    try {
      const res = await fetch(`/api/viewings/${viewing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: val }),
      })
      if (!res.ok) throw new Error('PATCH failed')
      onUpdate({ note: val || null })
      setEditingNote(false)
    } catch (err: any) {
      console.error('save note failed:', err)
      toast.error('備註儲存失敗')
      setNoteDraft(viewing.note || '')
    } finally {
      setSavingNote(false)
    }
  }

  const opinion = viewing.opinion

  // === disliked 態：縮小收合灰 ===
  if (opinion === 'disliked') {
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2 opacity-60 hover:opacity-80 transition-opacity">
        <div className="flex-1 min-w-0 text-sm text-slate-500 truncate">
          {titleText}
        </div>
        <button
          onClick={() => handleToggle('liked')}
          disabled={toggling !== null}
          className="text-sm hover:scale-110 transition-transform"
          title="喜歡"
        >
          🟣
        </button>
        <button
          onClick={() => handleToggle('disliked')}
          disabled={toggling !== null}
          className="text-sm hover:scale-110 transition-transform"
          title="取消不喜歡"
        >
          ⚫
        </button>
      </div>
    )
  }

  // === 預設 / liked 態 ===
  const frameClass =
    opinion === 'liked'
      ? 'border-purple-500 bg-purple-900/10'
      : 'border-slate-700 bg-slate-800/50'

  return (
    <div className={`border ${frameClass} rounded-lg p-3 transition-colors`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-400 shrink-0">{formatMonthDay(viewing.datetime)}</span>
            <span className="text-sm text-white font-medium truncate">·&nbsp;{titleText}</span>
            {communityUrl && (
              <a
                href={communityUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 shrink-0"
                title="社區資料"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            👤 {viewing.colleague_name}
            {viewing.colleague_phone ? ` · ${viewing.colleague_phone}` : ''}
          </div>
        </div>
      </div>

      {/* 備註（點擊編輯，失焦儲存） */}
      <div className="mt-2">
        {editingNote ? (
          <textarea
            ref={noteRef}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={handleSaveNote}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                setNoteDraft(viewing.note || '')
                setEditingNote(false)
              }
            }}
            disabled={savingNote}
            placeholder="備註..."
            rows={2}
            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
          />
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className="w-full text-left text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 rounded px-2 py-1 transition-colors whitespace-pre-wrap break-words"
          >
            {viewing.note || <span className="text-slate-600">點此新增備註...</span>}
          </button>
        )}
      </div>

      {/* 切換按鈕 */}
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={() => handleToggle('liked')}
          disabled={toggling !== null}
          className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
            opinion === 'liked'
              ? 'bg-purple-600/40 text-purple-200 ring-1 ring-purple-500/60'
              : 'text-slate-400 hover:bg-slate-700/50'
          }`}
        >
          <span>🟣</span>
          <span>喜歡</span>
        </button>
        <button
          onClick={() => handleToggle('disliked')}
          disabled={toggling !== null}
          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded text-slate-400 hover:bg-slate-700/50 transition-colors"
        >
          <span>⚫</span>
          <span>不喜歡</span>
        </button>
      </div>
    </div>
  )
}

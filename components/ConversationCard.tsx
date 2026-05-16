'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import type { Conversation } from '@/lib/types'

interface Props {
  conversation: Conversation
  onUpdate: (patch: Partial<Conversation>) => void
  onDelete?: () => void
}

function formatMonthDay(dateStr: string): string {
  const m = String(dateStr || '').match(/\d{4}-(\d{2})-(\d{2})/)
  if (m) return `${Number(m[1])}/${Number(m[2])}`
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function ConversationCard({ conversation, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation.content)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const important = !!conversation.is_important

  useEffect(() => {
    setDraft(conversation.content)
    setEditing(false)
    setError(null)
  }, [conversation.id, conversation.content])

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(draft.length, draft.length)
    }
  }, [editing, draft.length])

  const handleSave = async () => {
    const val = draft.trim()
    if (!val) {
      setError('內容不可為空')
      setDraft(conversation.content)
      setEditing(false)
      return
    }
    if (val === conversation.content.trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: val }),
      })
      if (!res.ok) throw new Error('PATCH failed')
      const data = await res.json()
      onUpdate({ content: data.conversation.content, updated_at: data.conversation.updated_at })
      setEditing(false)
    } catch (err: any) {
      console.error('save conversation failed:', err)
      toast.error('洽談儲存失敗')
      setError('儲存失敗，請重試')
      setDraft(conversation.content)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleImportant = async (next: boolean) => {
    if (toggling || next === important) return
    setToggling(true)
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isImportant: next }),
      })
      if (!res.ok) throw new Error('PATCH failed')
      onUpdate({ is_important: next })
    } catch (err: any) {
      console.error('toggle important failed:', err)
      toast.error('切換失敗')
    } finally {
      setToggling(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    if (!window.confirm('確定刪除此筆洽談？')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('DELETE failed')
      onDelete?.()
      toast.success('已刪除')
    } catch (err: any) {
      console.error('delete conversation failed:', err)
      toast.error('刪除失敗、請重試')
      setDeleting(false)
    }
  }

  const md = formatMonthDay(conversation.date)

  // 編輯態：兩種狀態共用同一個編輯框
  const editor = (
    <div>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            setDraft(conversation.content)
            setEditing(false)
            setError(null)
          }
        }}
        disabled={saving}
        rows={Math.max(3, draft.split('\n').length)}
        className="w-full bg-gray-800 border border-orange-500 rounded p-2 text-base text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
      {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
    </div>
  )

  // === 重要態：橘框放大（置頂由 ClientViewingsTab sortCards 處理）===
  if (important) {
    return (
      <div className="border-2 border-orange-500 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-orange-400 font-medium">
            {md}  📞 洽談
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-slate-500 hover:text-red-400 disabled:opacity-40 transition-colors p-1"
            title="刪除此筆洽談"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {editing ? (
          editor
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-full text-left text-base text-gray-100 whitespace-pre-wrap leading-relaxed hover:bg-slate-800/40 rounded px-1 py-0.5 transition-colors"
            title="點擊編輯"
          >
            {conversation.content || (
              <span className="text-slate-600">（空白、點擊編輯）</span>
            )}
          </button>
        )}

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => handleToggleImportant(true)}
            disabled={toggling}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-orange-600/40 text-orange-200 ring-1 ring-orange-500/60"
          >
            <span>🟠</span>
            <span>重要</span>
          </button>
          <button
            onClick={() => handleToggleImportant(false)}
            disabled={toggling}
            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded text-slate-400 hover:bg-slate-700/50 transition-colors"
          >
            <span>⚫</span>
            <span>取消</span>
          </button>
        </div>
      </div>
    )
  }

  // === 預設態：收合灰列（鏡像 ViewingCard disliked）===
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
      <span className="shrink-0 text-sm text-slate-500">
        {md && `${md}  `}📞 洽談
      </span>
      {editing ? (
        <div className="flex-1 min-w-0">{editor}</div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex-1 min-w-0 text-left text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 rounded px-1 truncate"
          title="點擊編輯"
        >
          {conversation.content?.trim()
            ? `· ${conversation.content.replace(/\n/g, ' ')}`
            : <span className="text-slate-600">（空白、點擊編輯）</span>}
        </button>
      )}
      <button
        onClick={() => handleToggleImportant(true)}
        disabled={toggling}
        className="text-sm hover:scale-110 transition-transform shrink-0 disabled:opacity-40"
        title="標重要（置頂、放大）"
      >
        🟠
      </button>
      <button
        onClick={() => handleToggleImportant(false)}
        disabled={toggling}
        className="text-sm hover:scale-110 transition-transform shrink-0 disabled:opacity-40"
        title="取消（保持收合）"
      >
        ⚫
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 p-1 text-slate-600 hover:text-red-400 disabled:opacity-40 transition-colors"
        title="刪除此筆洽談"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

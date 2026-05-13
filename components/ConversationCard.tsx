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
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function ConversationCard({ conversation, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation.content)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  return (
    <div className="border-2 border-orange-500 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-orange-400 font-medium">
          {formatMonthDay(conversation.date)}  📞 洽談
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
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import type { Block } from '@/lib/types'

interface Props {
  block: Block
  onUpdate: (patch: Partial<Block>) => void
  onDelete: () => void
}

export default function BlockItem({ block, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(block.text)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(block.text)
    setEditing(false)
  }, [block.id, block.text])

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(draft.length, draft.length)
    }
  }, [editing, draft.length])

  const handleSave = async () => {
    const val = draft.trim()
    if (!val) {
      setDraft(block.text)
      setEditing(false)
      return
    }
    if (val === block.text.trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/blocks/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: val }),
      })
      if (!res.ok) throw new Error('PATCH failed')
      const data = await res.json()
      onUpdate({ text: data.text })
      setEditing(false)
    } catch (err: any) {
      console.error('save block failed:', err)
      toast.error('儲存失敗、請重試')
      setDraft(block.text)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    if (!window.confirm('確定刪除此筆進度？')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/blocks/${block.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('DELETE failed')
      onDelete()
      toast.success('已刪除')
    } catch (err: any) {
      console.error('delete block failed:', err)
      toast.error('刪除失敗、請重試')
      setDeleting(false)
    }
  }

  return (
    <div className="group flex items-start gap-2">
      {editing ? (
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
              setDraft(block.text)
              setEditing(false)
            }
          }}
          disabled={saving}
          rows={Math.max(1, draft.split('\n').length)}
          className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 resize-none focus:outline-none focus:border-indigo-500"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex-1 min-w-0 text-left text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 rounded px-2 py-0.5 transition-colors whitespace-pre-wrap break-words"
          title="點擊編輯"
        >
          {block.text}
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 p-1 text-slate-600 hover:text-red-400 disabled:opacity-40 transition-colors opacity-0 group-hover:opacity-100"
        title="刪除此筆"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

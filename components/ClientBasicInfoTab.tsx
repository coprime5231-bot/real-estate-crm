'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Client, Grade } from '@/lib/types'

interface Props {
  client: Client
  onUpdate: (patch: Partial<Client>) => void
}

type EditableField =
  | 'name'
  | 'phone'
  | 'grade'
  | 'area'
  | 'budget'
  | 'needs'
  | 'needTags'
  | 'note'
  | 'birthday'

const GRADE_OPTIONS: Grade[] = ['A級', 'B級', 'C級']

// 客戶端送出 PATCH 的 payload 型別（area/needTags 傳字串給後端 parse）
type PatchBody = Partial<Omit<Client, 'area' | 'needTags'>> & {
  area?: string
  needTags?: string
}

function joinMulti(v?: string | string[]): string {
  if (!v) return ''
  if (Array.isArray(v)) return v.join('、')
  return v
}

export default function ClientBasicInfoTab({ client, onUpdate }: Props) {
  const [editing, setEditing] = useState<EditableField | null>(null)
  const [saving, setSaving] = useState<EditableField | null>(null)
  const [draft, setDraft] = useState<Record<EditableField, string>>({
    name: client.name || '',
    phone: client.phone || '',
    grade: client.grade || '',
    area: client.area || '',
    budget: client.budget || '',
    needs: client.needs || '',
    needTags: joinMulti(client.needTags),
    note: client.note || '',
    birthday: (client.birthday || '').slice(0, 10),
  })

  // client 切換時重置 draft；不 clobber 使用者正在編輯的欄位
  useEffect(() => {
    setDraft({
      name: client.name || '',
      phone: client.phone || '',
      grade: client.grade || '',
      area: client.area || '',
      budget: client.budget || '',
      needs: client.needs || '',
      needTags: joinMulti(client.needTags),
      note: client.note || '',
      birthday: (client.birthday || '').slice(0, 10),
    })
    setEditing(null)
  }, [client.id])

  const handleSave = async (field: EditableField) => {
    const value = draft[field]
    // 與目前值比較，無變動直接 exit edit mode
    const currentFormatted = (() => {
      switch (field) {
        case 'needTags':
          return joinMulti(client.needTags)
        case 'birthday':
          return (client.birthday || '').slice(0, 10)
        case 'grade':
          return client.grade || ''
        default:
          return (client[field] as string | undefined) || ''
      }
    })()
    if (value === currentFormatted) {
      setEditing(null)
      return
    }

    setSaving(field)
    try {
      const body: PatchBody = {}
      if (field === 'area') {
        body.area = value
      } else if (field === 'needTags') {
        body.needTags = value
      } else if (field === 'grade') {
        body.grade = (value as Grade) || undefined
      } else if (field === 'birthday') {
        body.birthday = value || null
      } else {
        body[field] = value
      }

      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json())?.error || 'PATCH failed')

      // 更新父層（area/needTags 特例：後端拆成陣列由前端也拆一次保持一致）
      const patch: Partial<Client> = {}
      if (field === 'area') {
        patch.area = value || undefined
      } else if (field === 'needTags') {
        patch.needTags = value
          .split(/[、,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
      } else if (field === 'birthday') {
        patch.birthday = value || null
      } else if (field === 'grade') {
        patch.grade = (value as Grade) || undefined
      } else {
        ;(patch as any)[field] = value
      }
      onUpdate(patch)
      setEditing(null)
    } catch (err: any) {
      console.error(`PATCH ${field} failed:`, err)
      toast.error(`儲存「${labelOf(field)}」失敗`)
      // 還原 draft
      setDraft((prev) => ({ ...prev, [field]: currentFormatted }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
      <Row label="姓名">
        <TextField
          field="name"
          value={draft.name}
          editing={editing === 'name'}
          saving={saving === 'name'}
          onStart={() => setEditing('name')}
          onChange={(v) => setDraft((p) => ({ ...p, name: v }))}
          onSave={() => handleSave('name')}
          displayValue={client.name}
          placeholder="—"
        />
      </Row>
      <Row label="手機">
        <TextField
          field="phone"
          value={draft.phone}
          editing={editing === 'phone'}
          saving={saving === 'phone'}
          onStart={() => setEditing('phone')}
          onChange={(v) => setDraft((p) => ({ ...p, phone: v }))}
          onSave={() => handleSave('phone')}
          displayValue={client.phone || '—'}
          inputType="tel"
        />
      </Row>
      <Row label="客戶等級">
        {editing === 'grade' ? (
          <select
            autoFocus
            disabled={saving === 'grade'}
            value={draft.grade}
            onChange={(e) => setDraft((p) => ({ ...p, grade: e.target.value }))}
            onBlur={() => handleSave('grade')}
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">未分級</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        ) : (
          <DisplayButton onClick={() => setEditing('grade')}>
            {client.grade || '—'}
          </DisplayButton>
        )}
      </Row>
      <Row label="區域">
        <TextField
          field="area"
          value={draft.area}
          editing={editing === 'area'}
          saving={saving === 'area'}
          onStart={() => setEditing('area')}
          onChange={(v) => setDraft((p) => ({ ...p, area: v }))}
          onSave={() => handleSave('area')}
          displayValue={client.area || '—'}
          placeholder="大安、中山（用「、」或「,」分隔）"
        />
      </Row>
      <Row label="預算">
        <TextField
          field="budget"
          value={draft.budget}
          editing={editing === 'budget'}
          saving={saving === 'budget'}
          onStart={() => setEditing('budget')}
          onChange={(v) => setDraft((p) => ({ ...p, budget: v }))}
          onSave={() => handleSave('budget')}
          displayValue={client.budget || '—'}
          placeholder="例：3000w"
        />
      </Row>
      <Row label="需求">
        <TextareaField
          field="needs"
          value={draft.needs}
          editing={editing === 'needs'}
          saving={saving === 'needs'}
          onStart={() => setEditing('needs')}
          onChange={(v) => setDraft((p) => ({ ...p, needs: v }))}
          onSave={() => handleSave('needs')}
          displayValue={client.needs || '—'}
        />
      </Row>
      <Row label="需求標籤">
        <TextField
          field="needTags"
          value={draft.needTags}
          editing={editing === 'needTags'}
          saving={saving === 'needTags'}
          onStart={() => setEditing('needTags')}
          onChange={(v) => setDraft((p) => ({ ...p, needTags: v }))}
          onSave={() => handleSave('needTags')}
          displayValue={joinMulti(client.needTags) || '—'}
          placeholder="4000w上下、大坪數（用「、」或「,」分隔）"
        />
      </Row>
      <Row label="備註">
        <TextareaField
          field="note"
          value={draft.note}
          editing={editing === 'note'}
          saving={saving === 'note'}
          onStart={() => setEditing('note')}
          onChange={(v) => setDraft((p) => ({ ...p, note: v }))}
          onSave={() => handleSave('note')}
          displayValue={client.note || '—'}
        />
      </Row>
      <Row label="生日">
        {editing === 'birthday' ? (
          <input
            type="date"
            autoFocus
            disabled={saving === 'birthday'}
            value={draft.birthday}
            onChange={(e) => setDraft((p) => ({ ...p, birthday: e.target.value }))}
            onBlur={() => handleSave('birthday')}
            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        ) : (
          <DisplayButton onClick={() => setEditing('birthday')}>
            {(client.birthday || '').slice(0, 10) || '—'}
          </DisplayButton>
        )}
      </Row>
    </div>
  )
}

function labelOf(field: EditableField): string {
  const map: Record<EditableField, string> = {
    name: '姓名',
    phone: '手機',
    grade: '客戶等級',
    area: '區域',
    budget: '預算',
    needs: '需求',
    needTags: '需求標籤',
    note: '備註',
    birthday: '生日',
  }
  return map[field]
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-3 items-start">
      <div className="text-sm text-slate-400 pt-1">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function DisplayButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left text-sm text-white hover:bg-slate-700/50 rounded px-2 py-1 transition-colors whitespace-pre-wrap break-words"
    >
      {children}
    </button>
  )
}

interface TextFieldProps {
  field: EditableField
  value: string
  editing: boolean
  saving: boolean
  onStart: () => void
  onChange: (v: string) => void
  onSave: () => void
  displayValue: string
  placeholder?: string
  inputType?: string
}

function TextField({
  value,
  editing,
  saving,
  onStart,
  onChange,
  onSave,
  displayValue,
  placeholder,
  inputType = 'text',
}: TextFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (!editing) {
    return <DisplayButton onClick={onStart}>{displayValue}</DisplayButton>
  }
  return (
    <input
      ref={inputRef}
      type={inputType}
      disabled={saving}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.currentTarget.blur()
        }
      }}
      placeholder={placeholder}
      className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
    />
  )
}

function TextareaField({
  value,
  editing,
  saving,
  onStart,
  onChange,
  onSave,
  displayValue,
}: Omit<TextFieldProps, 'inputType'>) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing) taRef.current?.focus()
  }, [editing])

  if (!editing) {
    return <DisplayButton onClick={onStart}>{displayValue}</DisplayButton>
  }
  return (
    <textarea
      ref={taRef}
      disabled={saving}
      value={value}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSave}
      onKeyDown={(e) => {
        // Shift+Enter 換行，Enter 儲存
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.currentTarget.blur()
        }
      }}
      className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
    />
  )
}

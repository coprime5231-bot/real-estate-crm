'use client'

import { useEffect, useState } from 'react'
import { X, Save, Phone, MapPin, Calendar, User } from 'lucide-react'

export type DevStatus = '募集' | '追蹤' | '委託' | '成交' | '過期'

export interface DevProperty {
  id: string
  name: string
  owner?: string
  address?: string
  householdAddress?: string
  status?: DevStatus
  closingDate?: string | null
  expiry?: string | null
  important?: string
  ownerPhone?: string
  ownerGrade?: string
  price?: string
  objectLetter?: string
  householdLetter?: string
  devLetter?: boolean
  devProgress: string[]
}

interface PropertyDetailModalProps {
  property: DevProperty | null
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, patch: Partial<DevProperty>, opts?: { autoPromoted?: boolean }) => Promise<void>
}

const STATUS_OPTIONS: DevStatus[] = ['募集', '追蹤', '委託', '成交', '過期']
const GRADE_OPTIONS = ['A級', 'B級', 'C級']

export default function PropertyDetailModal({
  property,
  isOpen,
  onClose,
  onSave,
}: PropertyDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<DevProperty | null>(property)

  useEffect(() => {
    setForm(property)
    setIsEditing(false)
  }, [property])

  if (!isOpen || !property || !form) return null

  const change = <K extends keyof DevProperty>(key: K, value: DevProperty[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSave = async () => {
    if (!form) return
    setIsSaving(true)
    try {
      const patch: Partial<DevProperty> = {}
      const keys: (keyof DevProperty)[] = [
        'name', 'owner', 'ownerPhone', 'address', 'status', 'price',
        'expiry', 'important', 'ownerGrade',
      ]
      for (const k of keys) {
        if ((form as any)[k] !== (property as any)[k]) {
          ;(patch as any)[k] = (form as any)[k]
        }
      }

      // 自動升級：募集 → 追蹤（當手機從無變有）
      let autoPromoted = false
      const phoneNowFilled = !!(form.ownerPhone && form.ownerPhone.trim())
      const phoneWasEmpty = !(property.ownerPhone && property.ownerPhone.trim())
      if (
        property.status === '募集' &&
        phoneNowFilled &&
        phoneWasEmpty &&
        // 沒手動改狀態才自動升級
        (patch.status === undefined)
      ) {
        patch.status = '追蹤'
        autoPromoted = true
      }

      if (Object.keys(patch).length === 0) {
        setIsEditing(false)
        return
      }

      await onSave(form.id, patch, { autoPromoted })
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {isEditing ? '編輯物件' : form.name || '(未命名)'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!isEditing ? (
            <>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-sm text-slate-400 mb-1">狀態</p>
                  <p className="text-white">{form.status || '未設定'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">屋主等級</p>
                  <p className="text-white">{form.ownerGrade || '未設定'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-1 flex items-center gap-1.5">
                  <User size={14} /> 屋主
                </p>
                <p className="text-white">{form.owner || '未設定'}</p>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-1 flex items-center gap-1.5">
                  <Phone size={14} /> 手機
                </p>
                <p className="text-white font-mono">{form.ownerPhone || '未設定'}</p>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-1 flex items-center gap-1.5">
                  <MapPin size={14} /> 物件地址
                </p>
                <p className="text-white">{form.address || '未設定'}</p>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-sm text-slate-400 mb-1">開價</p>
                  <p className="text-white">{form.price || '未設定'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1 flex items-center gap-1.5">
                    <Calendar size={14} /> 委託到期日
                  </p>
                  <p className="text-white">{form.expiry || '未設定'}</p>
                </div>
              </div>

              {form.important && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">重要事項</p>
                  <p className="text-amber-300/90 bg-amber-950/30 border border-amber-900/40 rounded px-3 py-2 text-sm whitespace-pre-wrap">
                    ⚠ {form.important}
                  </p>
                </div>
              )}

              {form.devProgress.length > 0 && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">開發進度</p>
                  <div className="flex flex-wrap gap-1">
                    {form.devProgress.map((p) => (
                      <span
                        key={p}
                        className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-200 border border-slate-600"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-1">物件名稱</label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={(e) => change('name', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">狀態</label>
                  <select
                    value={form.status || ''}
                    onChange={(e) => change('status', (e.target.value || undefined) as DevStatus | undefined)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">未設定</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">屋主等級</label>
                  <select
                    value={form.ownerGrade || ''}
                    onChange={(e) => change('ownerGrade', e.target.value || undefined)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">未分級</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">屋主</label>
                <input
                  type="text"
                  value={form.owner || ''}
                  onChange={(e) => change('owner', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1.5">
                  <Phone size={14} /> 手機
                  {property.status === '募集' && !property.ownerPhone && (
                    <span className="text-[10px] text-emerald-300/80 ml-1">
                      （填入後存檔自動升級到追蹤）
                    </span>
                  )}
                </label>
                <input
                  type="tel"
                  value={form.ownerPhone || ''}
                  onChange={(e) => change('ownerPhone', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">物件地址</label>
                <input
                  type="text"
                  value={form.address || ''}
                  onChange={(e) => change('address', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">開價</label>
                  <input
                    type="text"
                    value={form.price || ''}
                    onChange={(e) => change('price', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">委託到期日</label>
                  <input
                    type="date"
                    value={form.expiry || ''}
                    onChange={(e) => change('expiry', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">重要事項</label>
                <textarea
                  value={form.important || ''}
                  onChange={(e) => change('important', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white h-20 resize-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-700 bg-slate-800 px-6 py-4 flex gap-3 justify-end sticky bottom-0">
          {!isEditing ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700 transition-colors"
              >
                關閉
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                編輯
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setForm(property)
                  setIsEditing(false)
                }}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={16} />
                {isSaving ? '保存中…' : '保存'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { X, Save, Calendar, Phone, FileText } from 'lucide-react'
import { Client } from '@/lib/types'

interface ClientDetailModalProps {
  client: Client | null
  isOpen: boolean
  onClose: () => void
  onSave: (client: Client) => Promise<void>
}

export default function ClientDetailModal({
  client,
  isOpen,
  onClose,
  onSave,
}: ClientDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<Client | null>(client)

  if (!isOpen || !client) return null

  const handleSave = async () => {
    if (!formData) return
    setIsSaving(true)
    try {
      await onSave(formData)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (field: keyof Client, value: any) => {
    if (formData) {
      setFormData({ ...formData, [field]: value })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {isEditing ? '編輯客戶' : formData?.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!isEditing ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-400 mb-2">等級</p>
                  <p className="text-lg font-semibold text-white">
                    {formData?.grade || '未分配'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-2">來源</p>
                  <p className="text-lg font-semibold text-white">
                    {formData?.source || '未設置'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                  <Phone size={16} />
                  電話
                </p>
                <p className="text-white font-mono">{formData?.phone || '未設置'}</p>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-2">預算</p>
                <p className="text-white">{formData?.budget || '未設置'}</p>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-2">需求</p>
                <p className="text-white">{formData?.needs || '未設置'}</p>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-2">區域</p>
                <p className="text-white">{formData?.area || '未設置'}</p>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                  <Calendar size={16} />
                  下次跟進
                </p>
                <p className="text-white">{formData?.nextFollowUp || '未設置'}</p>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-2">最近進展</p>
                <p className="text-white">{formData?.progress || '未設置'}</p>
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                  <FileText size={16} />
                  備註
                </p>
                <p className="text-white whitespace-pre-wrap">{formData?.note || '未設置'}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-2">名稱</label>
                <input
                  type="text"
                  value={formData?.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">電話</label>
                <input
                  type="tel"
                  value={formData?.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">等級</label>
                <select
                  value={formData?.grade || ''}
                  onChange={(e) => handleChange('grade', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">選擇等級</option>
                  <option value="A級">A級</option>
                  <option value="B級">B級</option>
                  <option value="C級">C級</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">預算</label>
                <input
                  type="text"
                  value={formData?.budget || ''}
                  onChange={(e) => handleChange('budget', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">需求</label>
                <input
                  type="text"
                  value={formData?.needs || ''}
                  onChange={(e) => handleChange('needs', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">區域</label>
                <input
                  type="text"
                  value={formData?.area || ''}
                  onChange={(e) => handleChange('area', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">下次跟進</label>
                <input
                  type="date"
                  value={formData?.nextFollowUp || ''}
                  onChange={(e) => handleChange('nextFollowUp', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">最近進展</label>
                <textarea
                  value={formData?.progress || ''}
                  onChange={(e) => handleChange('progress', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">備註</label>
                <textarea
                  value={formData?.note || ''}
                  onChange={(e) => handleChange('note', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white h-24 resize-none"
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
                  setIsEditing(false)
                  setFormData(client)
                }}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={16} />
                {isSaving ? '保存中...' : '保存'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

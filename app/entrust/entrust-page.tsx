'use client'

import { FileText } from 'lucide-react'

export default function EntrustPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="text-indigo-400" size={28} />
          <h1 className="text-2xl font-bold">委託管理</h1>
        </div>
        <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-400">
          <FileText size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-lg">委託管理功能開發中...</p>
          <p className="text-sm mt-2">即將推出委託追蹤與管理功能</p>
        </div>
      </div>
    </div>
  )
}

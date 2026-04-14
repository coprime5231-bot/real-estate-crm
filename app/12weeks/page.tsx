'use client'

import { Calendar } from 'lucide-react'

export default function TwelveWeeksPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Calendar className="text-indigo-400" size={28} />
          <h1 className="text-2xl font-bold">12 周計畫</h1>
        </div>
        <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-400">
          <Calendar size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-lg">12 周計畫功能開發中...</p>
          <p className="text-sm mt-2">即將推出 12 周目標追蹤與進度管理</p>
        </div>
      </div>
    </div>
  )
}


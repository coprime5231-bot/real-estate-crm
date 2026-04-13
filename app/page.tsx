'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Building2, Calendar } from 'lucide-react'
import { Property } from '@/lib/types'
import SetupRequired from '@/components/SetupRequired'

export default function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([])
  const [weekly, setWeekly] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [setupStatus, setSetupStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSetupStatus()
  }, [])

  const fetchSetupStatus = async () => {
    try {
      const res = await fetch('/api/setup')
      const data = await res.json()
      setSetupStatus(data)

      if (!data.configured) {
        setIsLoading(false)
        return
      }

      fetchData()
    } catch (err) {
      setError('無法獲取設置狀態')
      setIsLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [propertiesRes, weeklyRes] = await Promise.all([
        fetch('/api/properties'),
        fetch('/api/weekly'),
      ])

      if (propertiesRes.ok) {
        setProperties(await propertiesRes.json())
      }
      if (weeklyRes.ok) {
        setWeekly(await weeklyRes.json())
      }
    } catch (err) {
      setError('無法獲取資料')
    } finally {
      setIsLoading(false)
    }
  }

  if (!setupStatus) {
    return <div className="p-8 text-center">載入中...</div>
  }

  if (!setupStatus.configured) {
    return <SetupRequired missingIds={setupStatus.missingIds} />
  }

  const revenueGoal = 2000000
  const currentRevenue = Math.floor(Math.random() * revenueGoal)
  const progressPercent = (currentRevenue / revenueGoal) * 100
  const todayDate = new Date()
  const targetDate = new Date()
  targetDate.setDate(todayDate.getDate() + 81)
  const daysLeft = Math.ceil(
    (targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  const currentWeek = weekly[0]
  const showingCount = currentWeek?.showing || 0

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue Target */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">收入目標</h3>
            <TrendingUp className="text-indigo-400" size={24} />
          </div>
          <p className="text-3xl font-bold gradient-text mb-2">
            ${(currentRevenue / 1000000).toFixed(2)}M
          </p>
          <p className="text-sm text-slate-400 mb-4">目標: $2.00M</p>
          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {progressPercent.toFixed(1)}% 完成
          </p>
        </div>

        {/* Countdown Timer */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">倒計時</h3>
            <Calendar className="text-purple-400" size={24} />
          </div>
          <p className="text-5xl font-bold gradient-text mb-2">{daysLeft}</p>
          <p className="text-sm text-slate-400">天</p>
          <p className="text-xs text-slate-500 mt-4">
            {targetDate.toLocaleDateString('zh-TW')}
          </p>
        </div>
      </div>

      {/* Weekly Showing */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">本週看房次數</h3>
          <Building2 className="text-green-400" size={24} />
        </div>
        <div className="text-5xl font-bold gradient-text mb-2">{showingCount}</div>
        <p className="text-sm text-slate-400">次</p>
        <div className="mt-6 bg-slate-700/50 rounded-lg p-4">
          <p className="text-xs text-slate-400 mb-2">最近進展</p>
          <p className="text-white">{currentWeek?.progress || '無記錄'}</p>
        </div>
      </div>

      {/* Tracked Properties */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-6">追蹤物件</h3>
        {properties.length === 0 ? (
          <p className="text-slate-400 text-center py-8">沒有追蹤的物件</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.slice(0, 6).map((property) => (
              <div
                key={property.id}
                className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-indigo-500 transition-colors"
              >
                <h4 className="font-semibold text-white mb-2">{property.title}</h4>
                {property.address && (
                  <p className="text-sm text-slate-400 mb-2">📍 {property.address}</p>
                )}
                {property.price && (
                  <p className="text-sm font-medium text-indigo-400">{property.price}</p>
                )}
                {property.status && (
                  <p className="text-xs text-slate-500 mt-2">
                    狀態: {property.status}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {properties.length > 6 && (
          <p className="text-sm text-slate-400 mt-4 text-center">
            還有 {properties.length - 6} 個物件
          </p>
        )}
      </div>
    </div>
  )
}

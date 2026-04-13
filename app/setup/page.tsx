'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Copy, RefreshCw, CheckCircle2 } from 'lucide-react'
import SetupRequired from '@/components/SetupRequired'

export default function SetupPage() {
  const [setupStatus, setSetupStatus] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    checkSetupStatus()
  }, [])

  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/setup')
      const data = await res.json()
      setSetupStatus(data)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 2000)
  }

  if (isLoading) {
    return <div className="p-8 text-center">檢查設置狀態中...</div>
  }

  if (!setupStatus) {
    return <div className="p-8 text-center">無法獲取設置狀態</div>
  }

  if (setupStatus.configured) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-6">
            <div className="flex gap-4">
              <CheckCircle2 className="text-green-400 flex-shrink-0" size={24} />
              <div>
                <h1 className="text-xl font-bold text-green-400 mb-2">設置完成</h1>
                <p className="text-green-100">
                  所有必要的環境變數已正確配置。您可以開始使用應用程式！
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">配置詳情</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p>✓ NOTION_API_KEY 已設置</p>
              <p>✓ 買家資料庫: 已配置</p>
              <p>✓ 任務資料庫: 已配置</p>
              <p>✓ 追蹤資料庫: 已配置</p>
              <p>✓ 週報資料庫: 已配置</p>
              <p>✓ 策略資料庫: 已配置</p>
              <p>✓ AI想法資料庫: 已配置</p>
            </div>
          </div>

          <div className="mt-8 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">後續步驟</h2>
            <ol className="space-y-3 text-slate-300">
              <li>
                1. 訪問應用程式的各個頁面以驗證數據是否正確加載
              </li>
              <li>
                2. 在 Notion 中編輯客戶資料並在應用程式中查看更新
              </li>
              <li>
                3. 使用應用程式的編輯功能更新客戶信息並驗證 Notion 更新
              </li>
              <li>
                4. 準備好後部署到 Zeabur
              </li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return <SetupRequired missingIds={setupStatus.missingIds} />
}

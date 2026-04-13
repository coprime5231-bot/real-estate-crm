'use client'

import { AlertCircle, Copy } from 'lucide-react'
import { useState } from 'react'

interface SetupRequiredProps {
  missingIds: string[]
}

export default function SetupRequired({ missingIds }: SetupRequiredProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-6 mb-8">
          <div className="flex gap-4">
            <AlertCircle className="text-amber-400 flex-shrink-0" size={24} />
            <div>
              <h1 className="text-xl font-bold text-amber-400 mb-2">設置需求</h1>
              <p className="text-amber-100">
                您需要配置以下環境變數才能使用此應用程式。
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">步驟 1: 複製環境變數</h2>
          <p className="text-slate-300 mb-4">
            在您的 .env.local 或 .env 檔案中添加以下變數：
          </p>

          <div className="space-y-3">
            {[
              'NOTION_API_KEY=ntn_xxx',
              ...missingIds.map(id => `${id}=`),
            ].map((line) => (
              <div
                key={line}
                className="bg-slate-900 border border-slate-700 rounded px-4 py-3 flex items-center justify-between group"
              >
                <code className="text-sm text-amber-300 font-mono break-all">{line}</code>
                <button
                  onClick={() => copyToClipboard(line)}
                  className="ml-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700"
                  title="複製"
                >
                  <Copy size={16} className="text-slate-400" />
                </button>
                {copied === line && (
                  <span className="text-xs text-green-400 ml-2">已複製</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mt-6">
          <h2 className="text-lg font-semibold text-white mb-4">步驟 2: 獲取 Notion API 金鑰</h2>
          <ol className="space-y-3 text-slate-300">
            <li>
              1. 訪問{' '}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                Notion Integration Page
              </a>
            </li>
            <li>2. 點擊 "Create new integration"</li>
            <li>3. 為您的集成起一個名稱（例如："房仲CRM"）</li>
            <li>4. 複製 "Internal Integration Token" 並粘貼到 NOTION_API_KEY</li>
            <li>5. 在 Notion 中與所有相關數據庫共享該集成</li>
          </ol>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mt-6">
          <h2 className="text-lg font-semibold text-white mb-4">步驟 3: 獲取數據庫 ID</h2>
          <ol className="space-y-3 text-slate-300">
            <li>1. 在 Notion 中打開每個數據庫</li>
            <li>
              2. 在瀏覽器 URL 中找到 ID。例如，如果 URL 是：
              <br />
              <code className="text-amber-300">
                notion.so/myworkspace/abc123def456?v=xyz
              </code>
              <br />
              ID 是 <code className="text-amber-300">abc123def456</code>
            </li>
            <li>3. 複製相應的數據庫 ID 到環境變數</li>
          </ol>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mt-6">
          <h2 className="text-lg font-semibold text-white mb-4">步驟 4: 部署到 Zeabur</h2>
          <ol className="space-y-3 text-slate-300">
            <li>
              1. 推送此代碼到 GitHub 倉庫
            </li>
            <li>
              2. 訪問{' '}
              <a
                href="https://zeabur.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                Zeabur
              </a>
            </li>
            <li>3. 連接您的 GitHub 倉庫</li>
            <li>4. 在項目設置中添加環境變數</li>
            <li>5. 部署！</li>
          </ol>
        </div>

        <div className="mt-8 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <p className="text-sm text-slate-400 text-center">
            配置完成後，刷新此頁面以開始使用應用程式。
          </p>
        </div>
      </div>
    </div>
  )
}

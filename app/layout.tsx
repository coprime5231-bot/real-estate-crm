import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Navigation from '@/components/Navigation'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '房仲CRM',
  description: '房地產代理人CRM系統 - Notion API整合',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className={`${inter.className} bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white min-h-screen`}>
        <Navigation />
        <main className="max-w-7xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  )
}

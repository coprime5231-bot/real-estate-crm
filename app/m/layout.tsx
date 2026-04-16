import type { Metadata, Viewport } from 'next'
import { AnimationProvider } from './AnimationProvider'
import MBANav from './MBANav'

export const metadata: Metadata = {
  title: 'MBA — 日任務',
  description: '房仲日常任務遊戲化',
  manifest: '/m/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MBA',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0B1020',
}

export default function MBALayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0B1020',
        color: '#F5F5FA',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        paddingBottom: 120,
      }}
    >
      <AnimationProvider>{children}</AnimationProvider>
      <MBANav />
    </div>
  )
}

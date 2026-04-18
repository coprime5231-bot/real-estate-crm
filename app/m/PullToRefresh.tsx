'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const THRESHOLD = 80
const MAX_PULL = 140
const PULL_RESISTANCE = 0.5

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pullY, setPullY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const startYRef = useRef<number | null>(null)
  const isPendingRef = useRef(false)
  const pullYRef = useRef(0)

  isPendingRef.current = isPending
  pullYRef.current = pullY

  useEffect(() => {
    function atTop() {
      return (
        window.scrollY <= 0 &&
        (document.documentElement.scrollTop ?? 0) <= 0
      )
    }

    function onTouchStart(e: TouchEvent) {
      if (isPendingRef.current) return
      if (!atTop()) return
      startYRef.current = e.touches[0].clientY
      setIsDragging(true)
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current == null) return
      // 若已被滾出頂部（例如同一 gesture 先上滑再下拉），取消這次 PTR
      if (!atTop()) {
        startYRef.current = null
        setPullY(0)
        setIsDragging(false)
        return
      }
      const dy = e.touches[0].clientY - startYRef.current
      if (dy <= 0) {
        setPullY(0)
        return
      }
      // 抓住手勢：阻止 iOS 橡皮筋 / address bar 收合
      if (e.cancelable) e.preventDefault()
      setPullY(Math.min(MAX_PULL, dy * PULL_RESISTANCE))
    }

    function onTouchEnd() {
      if (startYRef.current == null) return
      const currentPull = pullYRef.current
      startYRef.current = null
      setIsDragging(false)
      if (currentPull >= THRESHOLD && !isPendingRef.current) {
        setPullY(THRESHOLD)
        startTransition(() => router.refresh())
      } else {
        setPullY(0)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('touchcancel', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [router])

  // refresh 結束 → 收回指示器
  useEffect(() => {
    if (!isPending && !isDragging && pullY > 0) {
      const t = setTimeout(() => setPullY(0), 80)
      return () => clearTimeout(t)
    }
  }, [isPending, isDragging, pullY])

  const reached = pullY >= THRESHOLD
  const displayY = isPending ? THRESHOLD : pullY
  const label = isPending ? '載入中…' : reached ? '放開刷新' : '下拉刷新'

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(displayY, 0),
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: 8,
          pointerEvents: 'none',
          zIndex: 50,
          overflow: 'hidden',
          transition: isDragging ? 'none' : 'height 0.2s ease',
        }}
      >
        {displayY > 0 && (
          <div
            style={{
              color: '#FFD86B',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            {isPending ? (
              <span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    marginRight: 8,
                    border: '2px solid #FFD86B',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    verticalAlign: 'middle',
                    animation: 'mba-ptr-spin 0.8s linear infinite',
                  }}
                />
                {label}
              </span>
            ) : (
              label
            )}
          </div>
        )}
      </div>
      <div
        style={{
          transform: `translateY(${displayY}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
      <style>{`@keyframes mba-ptr-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}

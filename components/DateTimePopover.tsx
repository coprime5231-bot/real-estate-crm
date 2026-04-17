'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'

export function formatTodayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 現在時間 + 1 小時，捨入到最近 15 分
export function computeDefaultTime(): string {
  const d = new Date()
  d.setHours(d.getHours() + 1)
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// 打開 popover 時若 date/time 為空，自動補預設值
export function withDefaultsIfEmpty(date: string, time: string) {
  return {
    date: date || formatTodayISO(),
    time: time || computeDefaultTime(),
  }
}

interface DateTimePopoverProps {
  date: string
  time: string
  onChange: (date: string, time: string) => void
  iconSize?: number
  buttonClass?: string
  activeButtonClass?: string
  align?: 'left' | 'right'
  title?: string
  defaultOpen?: boolean
}

export default function DateTimePopover({
  date,
  time,
  onChange,
  iconSize = 14,
  buttonClass = 'p-1.5 bg-slate-900 border border-slate-600 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 rounded transition-colors',
  activeButtonClass = 'p-1.5 bg-indigo-900/40 border border-indigo-500/60 text-indigo-300 hover:text-indigo-200 rounded transition-colors',
  align = 'left',
  title,
  defaultOpen = false,
}: DateTimePopoverProps) {
  const [open, setOpen] = useState(defaultOpen)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hasAppliedDefaultOpenRef = useRef(false)

  // 首次以 defaultOpen=true 掛載時，補預設值
  useEffect(() => {
    if (defaultOpen && !hasAppliedDefaultOpenRef.current) {
      hasAppliedDefaultOpenRef.current = true
      const next = withDefaultsIfEmpty(date, time)
      if (next.date !== date || next.time !== time) {
        onChange(next.date, next.time)
      }
    }
  }, [defaultOpen, date, time, onChange])

  // 點擊外部關閉
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleToggle = useCallback(() => {
    const willOpen = !open
    if (willOpen) {
      const next = withDefaultsIfEmpty(date, time)
      if (next.date !== date || next.time !== time) {
        onChange(next.date, next.time)
      }
    }
    setOpen(willOpen)
  }, [open, date, time, onChange])

  const hasValue = Boolean(date)
  const displayLabel = hasValue
    ? `${date}${time ? ' ' + time : ''}`
    : '選擇日期時間'

  return (
    <div className="relative shrink-0" ref={wrapperRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={hasValue ? activeButtonClass : buttonClass}
        title={displayLabel}
        aria-label={displayLabel}
      >
        <Calendar size={iconSize} />
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 z-30 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl min-w-[260px]`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {title && <div className="text-xs text-slate-400 mb-2">{title}</div>}
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => onChange(e.target.value, time)}
              autoFocus
              className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <input
              type="time"
              value={time}
              step={900}
              onChange={(e) => onChange(date, e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 w-[100px]"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <button
              type="button"
              onClick={() => onChange('', '')}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              清除
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

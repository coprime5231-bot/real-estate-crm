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

// 把任意 HH:MM 捨入到最近的 15 分
function snapTo15(time: string): string {
  if (!time || !/^\d{1,2}:\d{1,2}$/.test(time)) return time
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10)
  let m = Math.round(parseInt(mStr, 10) / 15) * 15
  if (m === 60) { m = 0; h = (h + 1) % 24 }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const HOUR_OPTIONS_12 = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11']
const MINUTE_OPTIONS = ['00', '15', '30', '45']

// 24h「HH」轉 12h { h12, ampm }
function to12(h24: string): { h12: string; ampm: 'AM' | 'PM' } {
  const h = parseInt(h24, 10)
  if (isNaN(h)) return { h12: '', ampm: 'AM' }
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM'
  const m = h % 12
  const h12 = m === 0 ? 12 : m
  return { h12: String(h12).padStart(2, '0'), ampm }
}

// 12h { h12, ampm } 轉回 24h「HH」
function from12(h12: string, ampm: 'AM' | 'PM'): string {
  let h = parseInt(h12, 10)
  if (isNaN(h)) return ''
  if (ampm === 'AM') {
    if (h === 12) h = 0
  } else if (h !== 12) {
    h += 12
  }
  return String(h).padStart(2, '0')
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
  /** 顯示為 12 小時制 + AM/PM（內部 time 仍存 24h "HH:MM"）。預設 false */
  hour12?: boolean
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
  hour12 = false,
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
  const currentHour24 = time ? time.split(':')[0] : ''
  const currentMinute = time ? snapTo15(time).split(':')[1] : ''
  const { h12: currentH12, ampm: currentAmpm } = to12(currentHour24)
  let timeLabel = time
  if (time && hour12) {
    const mmPart = time.split(':')[1] || '00'
    timeLabel = `${currentAmpm === 'AM' ? '上午' : '下午'} ${currentH12}:${mmPart}`
  }
  const displayLabel = hasValue
    ? `${date}${time ? ' ' + timeLabel : ''}`
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
            <div className="flex items-center gap-1">
              {hour12 && (
                <select
                  value={currentAmpm}
                  onChange={(e) => {
                    const ampm = e.target.value as 'AM' | 'PM'
                    if (!currentH12) {
                      onChange(date, '')
                      return
                    }
                    const hh = from12(currentH12, ampm)
                    const mm = currentMinute || '00'
                    onChange(date, `${hh}:${mm}`)
                  }}
                  className="bg-slate-900 border border-slate-600 rounded px-1.5 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="AM">上午</option>
                  <option value="PM">下午</option>
                </select>
              )}
              {hour12 ? (
                <select
                  value={currentH12}
                  onChange={(e) => {
                    const h12 = e.target.value
                    const hh = h12 ? from12(h12, currentAmpm) : ''
                    const mm = currentMinute || '00'
                    onChange(date, hh ? `${hh}:${mm}` : '')
                  }}
                  className="bg-slate-900 border border-slate-600 rounded px-1.5 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">--</option>
                  {HOUR_OPTIONS_12.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              ) : (
                <select
                  value={currentHour24}
                  onChange={(e) => {
                    const hh = e.target.value
                    const mm = currentMinute || '00'
                    onChange(date, hh ? `${hh}:${mm}` : '')
                  }}
                  className="bg-slate-900 border border-slate-600 rounded px-1.5 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">--</option>
                  {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              )}
              <span className="text-slate-500 text-sm">:</span>
              <select
                value={currentMinute}
                onChange={(e) => {
                  const mm = e.target.value
                  const hh = currentHour24 || (hour12 ? from12('09', 'AM') : '09')
                  onChange(date, mm ? `${hh}:${mm}` : '')
                }}
                className="bg-slate-900 border border-slate-600 rounded px-1.5 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">--</option>
                {MINUTE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
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

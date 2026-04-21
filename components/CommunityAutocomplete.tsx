'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link2, MapPin } from 'lucide-react'
import type { Community } from '@/lib/types'

interface Props {
  name: string
  onChange: (name: string) => void
  onSelectCommunity: (community: Community) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  inputClassName?: string
}

export default function CommunityAutocomplete({
  name,
  onChange,
  onSelectCommunity,
  onBlur,
  placeholder,
  className,
  inputClassName,
}: Props) {
  const [suggestions, setSuggestions] = useState<Community[]>([])
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      const res = await fetch(`/api/communities?${params.toString()}`, { signal: ctrl.signal })
      if (!res.ok) return
      const data: Community[] = await res.json()
      if (!ctrl.signal.aborted) setSuggestions(data)
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('communities search failed:', err)
      }
    }
  }, [])

  // name 變動 → debounce 200ms 後打 API（僅在下拉打開時）
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(name.trim())
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [name, open, fetchSuggestions])

  // 點外面收下拉
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const handleFocus = () => {
    setOpen(true)
    fetchSuggestions(name.trim())
  }

  const handleSelect = (c: Community) => {
    onSelectCommunity(c)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className={`relative ${className || ''}`}>
      <input
        type="text"
        value={name}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={handleFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-600 rounded shadow-xl max-h-48 overflow-y-auto">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(c)
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
            >
              <MapPin size={12} className="text-slate-500 shrink-0" />
              <span className="flex-1 truncate">{c.name}</span>
              {c.leju_url && (
                <Link2 size={12} className="text-sky-400 shrink-0" aria-label="有樂居連結" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

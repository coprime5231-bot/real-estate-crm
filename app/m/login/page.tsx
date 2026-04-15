'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MBALogin() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/m/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError('密碼錯誤')
        setLoading(false)
        return
      }
      router.push('/m')
      router.refresh()
    } catch {
      setError('登入失敗，請再試一次')
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 48 }}>⭐🐈</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 0' }}>MBA 登入</h1>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密碼"
          autoFocus
          inputMode="numeric"
          style={{
            padding: '12px 14px',
            fontSize: 16,
            background: '#2A2E3C',
            border: '1px solid #3A3E4C',
            borderRadius: 10,
            color: '#F5F5FA',
            outline: 'none',
          }}
        />

        {error && (
          <div style={{ color: '#FF6B6B', fontSize: 13, textAlign: 'center' }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            padding: '12px',
            fontSize: 16,
            fontWeight: 600,
            background: loading ? '#5A5E6C' : '#FFD86B',
            color: '#0B1020',
            border: 'none',
            borderRadius: 10,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '登入中…' : '進入'}
        </button>
      </form>
    </main>
  )
}

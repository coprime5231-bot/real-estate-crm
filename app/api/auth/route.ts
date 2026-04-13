import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    // 比對環境變數中的密碼
    if (password === process.env.CRM_PASSWORD) {
      const response = NextResponse.json({ success: true })

      // 設定認證 cookie（7 天有效）
      response.cookies.set('crm-auth', process.env.CRM_AUTH_SECRET || 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 天
        path: '/',
      })

      return response
    }

    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }
}

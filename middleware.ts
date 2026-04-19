import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ===== MBA（/m/*）走 mba-auth =====
  if (pathname === '/m' || pathname.startsWith('/m/') || pathname.startsWith('/api/m/')) {
    if (pathname === '/m/login' || pathname === '/api/m/auth') {
      return NextResponse.next()
    }

    const mbaToken = request.cookies.get('mba-auth')?.value
    if (!mbaToken || mbaToken !== process.env.MBA_AUTH_SECRET) {
      const loginUrl = new URL('/m/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // ===== CRM（其他路徑）走 crm-auth =====
  if (pathname === '/login' || pathname === '/api/auth') {
    return NextResponse.next()
  }

  // MBA 需要讀 /api/notion/weekly-tasks（歷史原因沒放在 /api/m 下）
  // → 接受 CRM 或 MBA 任一 cookie，讓 MBA 不依賴 CRM 登入狀態
  if (pathname === '/api/notion/weekly-tasks') {
    const crmOk = request.cookies.get('crm-auth')?.value === process.env.CRM_AUTH_SECRET
    const mbaOk = request.cookies.get('mba-auth')?.value === process.env.MBA_AUTH_SECRET
    if (crmOk || mbaOk) return NextResponse.next()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const authToken = request.cookies.get('crm-auth')?.value
  if (!authToken || authToken !== process.env.CRM_AUTH_SECRET) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|userscripts).*)',
  ],
}

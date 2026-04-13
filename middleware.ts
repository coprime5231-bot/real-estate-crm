import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 不需要驗證的路徑：登入頁面和登入 API
  if (pathname === '/login' || pathname === '/api/auth') {
    return NextResponse.next()
  }

  // 檢查是否有登入 cookie
  const authToken = request.cookies.get('crm-auth')?.value

  if (!authToken || authToken !== process.env.CRM_AUTH_SECRET) {
    // 未登入 → 導向登入頁面
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

// 要保護的路徑（所有頁面和 API）
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

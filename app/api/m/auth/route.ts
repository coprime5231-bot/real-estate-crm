import { NextResponse } from 'next/server'

const NINETY_DAYS = 60 * 60 * 24 * 90

export async function POST(req: Request) {
  try {
    const { password } = await req.json()
    const expected = process.env.MBA_PASSWORD
    const secret = process.env.MBA_AUTH_SECRET

    if (!expected || !secret) {
      return NextResponse.json(
        { error: 'MBA_PASSWORD / MBA_AUTH_SECRET not configured' },
        { status: 500 },
      )
    }

    if (password !== expected) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set('mba-auth', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: NINETY_DAYS,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { currentQuarter } from '@/lib/mba/db'
import { getStarBalance } from '@/lib/mba/chest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const quarter = currentQuarter()
    const balance = await getStarBalance(quarter)

    return NextResponse.json({
      stars: balance.stars,
      chestsAvailable: balance.chestsAvailable,
      quarter,
    })
  } catch (err) {
    console.error('[stats/stars] error', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'unknown' },
      { status: 500 },
    )
  }
}

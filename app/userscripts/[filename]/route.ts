import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['b6-lookup.user.js'])

export async function GET(
  _req: Request,
  { params }: { params: { filename: string } },
) {
  if (!ALLOWED.has(params.filename)) {
    return new NextResponse('Not Found', { status: 404 })
  }
  const cwd = process.cwd()
  const filePath = path.join(cwd, 'public', 'userscripts', params.filename)
  try {
    const source = fs.readFileSync(filePath, 'utf-8')
    return new NextResponse(source, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=60, must-revalidate',
      },
    })
  } catch (err) {
    const lines = [
      'userscript asset missing from deployment',
      `cwd: ${cwd}`,
      `filePath: ${filePath}`,
      `error: ${(err as Error).message}`,
    ]
    for (const dir of ['public/userscripts', 'public', '.']) {
      try {
        const list = fs.readdirSync(path.join(cwd, dir))
        lines.push(`ls ${dir}: ${JSON.stringify(list)}`)
      } catch (e) {
        lines.push(`ls ${dir} failed: ${(e as Error).message}`)
      }
    }
    return new NextResponse(lines.join('\n'), {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

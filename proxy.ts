export const runtime = 'nodejs'

import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register']

export default auth(req => {
  const { pathname } = req.nextUrl

  const isPublic =
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/api/auth')

  if (!req.auth && !isPublic) {
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
}

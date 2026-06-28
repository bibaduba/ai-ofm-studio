import { NextRequest, NextResponse } from "next/server"

const SESSION_COOKIE = "ai_ofm_session"

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/wavespeed/:path*", "/dashboard/:path*"],
}

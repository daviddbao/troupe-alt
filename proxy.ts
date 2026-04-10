import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const PUBLIC_ROUTES = ["/login", "/signup"]
const INVITE_PREFIX = "/invite"

export const proxy = auth(function proxy(req) {
  const { pathname } = req.nextUrl

  const isPublic =
    PUBLIC_ROUTES.includes(pathname) || pathname.startsWith(INVITE_PREFIX)

  // Redirect unauthenticated users to login
  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (req.auth && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
}

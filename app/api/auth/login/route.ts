import { NextResponse } from "next/server"
import {
  createSession,
  normalizeUsername,
  setSessionCookie,
  verifyPassword,
  type UserRecord,
} from "@/app/lib/auth"
import { db } from "@/app/lib/db"

export async function POST(request: Request) {
  const body = await request.json()
  const username = normalizeUsername(body.username)
  const password = String(body.password || "")
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as UserRecord | undefined

  if (!user || !verifyPassword(password, user)) {
    return NextResponse.json(
      { error: "Неверный логин или пароль." },
      { status: 401 },
    )
  }

  const session = createSession(user.id)
  const response = NextResponse.json({ id: user.id, username: user.username })
  setSessionCookie(response, session.token, session.expiresAt)
  return response
}

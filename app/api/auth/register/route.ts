import { NextResponse } from "next/server"
import {
  claimUnownedData,
  createPassword,
  createSession,
  normalizeUsername,
  setSessionCookie,
  validateCredentials,
} from "@/app/lib/auth"
import { createId, db, now } from "@/app/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const username = normalizeUsername(body.username)
    const password = String(body.password || "")
    const validationError = validateCredentials(username, password)

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const existing = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(username)
    if (existing) {
      return NextResponse.json(
        { error: "Этот логин уже занят." },
        { status: 409 },
      )
    }

    const userCount = Number(
      (
        db.prepare("SELECT COUNT(*) AS count FROM users").get() as {
          count: number
        }
      ).count,
    )
    const userId = createId()
    const timestamp = now()
    const passwordData = createPassword(password)

    db.prepare(
      `INSERT INTO users (id, username, passwordHash, passwordSalt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      username,
      passwordData.hash,
      passwordData.salt,
      timestamp,
      timestamp,
    )

    if (userCount === 0) claimUnownedData(userId)

    const session = createSession(userId)
    const response = NextResponse.json(
      { id: userId, username },
      { status: 201 },
    )
    setSessionCookie(response, session.token, session.expiresAt)
    return response
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось создать аккаунт.",
      },
      { status: 500 },
    )
  }
}

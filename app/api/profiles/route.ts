import { NextResponse } from "next/server"
import { createId, db, now, type ProfileRecord } from "@/app/lib/db"
import { getCurrentUser } from "@/app/lib/auth"

export async function GET() {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const profiles = db
    .prepare("SELECT * FROM profiles WHERE userId = ? ORDER BY updatedAt DESC")
    .all(user.id) as ProfileRecord[]

  if (profiles.length === 0) {
    const timestamp = now()
    const defaultName = db
      .prepare("SELECT id FROM profiles WHERE name = ?")
      .get("Personal")
      ? `Personal @${user.username}`
      : "Personal"
    const profile = {
      id: createId(),
      userId: user.id,
      name: defaultName,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    db.prepare(
      "INSERT INTO profiles (id, userId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
    ).run(
      profile.id,
      profile.userId,
      profile.name,
      profile.createdAt,
      profile.updatedAt,
    )
    return NextResponse.json([profile])
  }

  return NextResponse.json(profiles)
}

export async function POST(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name } = await request.json()
  const trimmedName = String(name || "").trim()

  if (!trimmedName) {
    return NextResponse.json(
      { error: "Profile name is required." },
      { status: 400 },
    )
  }

  const existing = db
    .prepare("SELECT * FROM profiles WHERE userId = ? AND name = ?")
    .get(user.id, trimmedName) as ProfileRecord | undefined

  if (existing) {
    return NextResponse.json(existing)
  }

  const timestamp = now()
  const profile = {
    id: createId(),
    userId: user.id,
    name: trimmedName,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  try {
    db.prepare(
      "INSERT INTO profiles (id, userId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
    ).run(
      profile.id,
      profile.userId,
      profile.name,
      profile.createdAt,
      profile.updatedAt,
    )
  } catch {
    return NextResponse.json(
      { error: "Профиль с таким именем уже существует. Выберите другое имя." },
      { status: 409 },
    )
  }

  return NextResponse.json(profile)
}

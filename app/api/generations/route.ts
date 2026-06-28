import { NextResponse } from "next/server"
import { createId, db, now, type GenerationRecord } from "@/app/lib/db"
import {
  generateGeminiImage,
  generateGeminiVideo,
  type GeminiSourceImage,
} from "@/app/lib/gemini"
import { getCurrentUser } from "@/app/lib/auth"

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function wrapText(value: string, maxLineLength = 42) {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ""

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word
    if (nextLine.length > maxLineLength && line) {
      lines.push(line)
      line = word
    } else {
      line = nextLine
    }
  })

  if (line) lines.push(line)
  return lines.slice(0, 5)
}

export async function GET(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const profileId = searchParams.get("profileId")
  const search = searchParams.get("search") || ""
  const favorite = searchParams.get("favorite") === "true"
  const mediaType = searchParams.get("mediaType")

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required." },
      { status: 400 },
    )
  }

  const ownedProfile = db
    .prepare("SELECT id FROM profiles WHERE id = ? AND userId = ?")
    .get(profileId, user.id)
  if (!ownedProfile)
    return NextResponse.json({ error: "Profile not found." }, { status: 404 })

  const clauses = ["profileId = ?"]
  const values: Array<string | number> = [profileId]

  if (favorite) {
    clauses.push("favorite = 1")
  }

  if (mediaType === "image" || mediaType === "video") {
    clauses.push("mediaType = ?")
    values.push(mediaType)
  }

  if (search) {
    clauses.push("prompt LIKE ?")
    values.push(`%${search}%`)
  }

  const generations = db
    .prepare(
      `SELECT * FROM generations WHERE ${clauses.join(" AND ")} ORDER BY createdAt DESC`,
    )
    .all(...values) as GenerationRecord[]

  return NextResponse.json(
    generations.map((item) => ({ ...item, favorite: Boolean(item.favorite) })),
  )
}

export async function POST(request: Request) {
  try {
    const user = getCurrentUser()
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const profileId = String(body.profileId || "")
    const apiKey = String(body.apiKey || "")
    const prompt = String(body.prompt || "").trim()
    const mediaType = body.mediaType === "video" ? "video" : "image"
    const model = String(body.model || "gemini-2.5-flash-image")
    const aspectRatio = String(body.aspectRatio || "1:1")
    const resolution = String(body.resolution || "1K")
    const durationSeconds = String(body.durationSeconds || "8")
    const sourceImages = (body.sourceImages || []) as GeminiSourceImage[]

    if (!profileId || !apiKey || !prompt) {
      return NextResponse.json(
        { error: "profileId, apiKey and prompt are required." },
        { status: 400 },
      )
    }

    const ownedProfile = db
      .prepare("SELECT id FROM profiles WHERE id = ? AND userId = ?")
      .get(profileId, user.id)
    if (!ownedProfile)
      return NextResponse.json({ error: "Profile not found." }, { status: 404 })

    const imageData =
      mediaType === "video"
        ? await generateGeminiVideo({
            apiKey,
            prompt,
            model,
            sourceImages,
            aspectRatio,
            durationSeconds,
            resolution,
          })
        : await generateGeminiImage({
            apiKey,
            prompt: `${prompt}\n\nAspect ratio: ${aspectRatio}. Resolution target: ${resolution}.`,
            model,
            sourceImages,
          })

    const timestamp = now()
    const generation = {
      id: createId(),
      profileId,
      mediaType,
      prompt,
      imageData,
      sourceImages: JSON.stringify(sourceImages),
      model,
      aspectRatio,
      resolution,
      favorite: false,
      createdAt: timestamp,
    }

    db.prepare(
      `INSERT INTO generations
        (id, profileId, mediaType, prompt, imageData, sourceImages, model, aspectRatio, resolution, favorite, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      generation.id,
      generation.profileId,
      generation.mediaType,
      generation.prompt,
      generation.imageData,
      generation.sourceImages,
      generation.model,
      generation.aspectRatio,
      generation.resolution,
      0,
      generation.createdAt,
    )
    db.prepare("UPDATE profiles SET updatedAt = ? WHERE id = ?").run(
      timestamp,
      profileId,
    )

    return NextResponse.json(generation)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed."
    const isQuotaError =
      message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("rate limit")

    return NextResponse.json(
      {
        error: isQuotaError
          ? "Google отклонил запрос из-за квоты проекта. Проверь billing/rate limits в Google AI Studio. Для картинок нужен доступ к gemini-2.5-flash-image или gemini-3-pro-image-preview."
          : message,
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id, favorite } = await request.json()

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 })
  }

  db.prepare(
    `UPDATE generations SET favorite = ? WHERE id = ? AND profileId IN
     (SELECT id FROM profiles WHERE userId = ?)`,
  ).run(favorite ? 1 : 0, id, user.id)
  const generation = db
    .prepare(
      `SELECT generations.* FROM generations JOIN profiles ON profiles.id = generations.profileId
     WHERE generations.id = ? AND profiles.userId = ?`,
    )
    .get(id, user.id) as GenerationRecord | undefined

  if (!generation) {
    return NextResponse.json(
      { error: "Generation not found." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ...generation,
    favorite: Boolean(generation.favorite),
  })
}

export async function DELETE(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 })
  }

  db.prepare(
    `DELETE FROM generations WHERE id = ? AND profileId IN
     (SELECT id FROM profiles WHERE userId = ?)`,
  ).run(id, user.id)
  return NextResponse.json({ ok: true })
}

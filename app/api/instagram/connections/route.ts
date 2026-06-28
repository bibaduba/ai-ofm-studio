import { NextResponse } from "next/server"
import { getCurrentUser } from "@/app/lib/auth"
import { db } from "@/app/lib/db"
import { instagramConfig } from "@/app/lib/instagram"

type ModelConnectionRow = {
  id: string
  name: string
  faceReferences: string
  bodyReferences: string
  createdAt: string
  connectionId: string | null
  instagramUserId: string | null
  instagramUsername: string | null
  instagramDisplayName: string | null
  instagramProfilePictureUrl: string | null
  tokenExpiresAt: string | null
}

export async function GET(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = db
    .prepare(
      `SELECT models.id, models.name, models.faceReferences, models.bodyReferences,
              models.createdAt, connections.id AS connectionId,
              connections.instagramUserId, connections.username AS instagramUsername,
              connections.displayName AS instagramDisplayName,
              connections.profilePictureUrl AS instagramProfilePictureUrl,
              connections.tokenExpiresAt
       FROM wavespeed_models AS models
       LEFT JOIN instagram_connections AS connections
         ON connections.wavespeedModelId = models.id AND connections.userId = models.userId
       WHERE models.userId = ?
       ORDER BY models.updatedAt DESC`,
    )
    .all(user.id) as ModelConnectionRow[]

  let configured = true
  let configurationError = ""
  try {
    instagramConfig(new URL(request.url).origin)
  } catch (error) {
    configured = false
    configurationError =
      error instanceof Error ? error.message : "Instagram is not configured."
  }

  return NextResponse.json({ configured, configurationError, models: rows })
}

export async function DELETE(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const modelId = new URL(request.url).searchParams.get("modelId") || ""
  if (!modelId) {
    return NextResponse.json({ error: "modelId is required." }, { status: 400 })
  }

  db.prepare(
    "DELETE FROM instagram_connections WHERE wavespeedModelId = ? AND userId = ?",
  ).run(modelId, user.id)
  return NextResponse.json({ ok: true })
}

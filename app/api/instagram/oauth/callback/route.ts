import { NextResponse } from "next/server"
import { getCurrentUser } from "@/app/lib/auth"
import {
  createId,
  db,
  now,
  type InstagramConnectionRecord,
  type WavespeedModelRecord,
} from "@/app/lib/db"
import {
  encryptInstagramToken,
  exchangeInstagramCode,
  getInstagramProfile,
} from "@/app/lib/instagram"

type OAuthState = {
  state: string
  userId: string
  wavespeedModelId: string
  expiresAt: string
  createdAt: string
}

function dashboardRedirect(request: Request, status: string, message?: string) {
  const url = new URL("/dashboard", request.url)
  url.searchParams.set("instagram", status)
  if (message) url.searchParams.set("message", message)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const user = getCurrentUser()
  if (!user) return NextResponse.redirect(new URL("/login", request.url))

  const url = new URL(request.url)
  const providerError = url.searchParams.get("error")
  if (providerError) {
    return dashboardRedirect(
      request,
      "cancelled",
      url.searchParams.get("error_description") || providerError,
    )
  }

  const code = url.searchParams.get("code") || ""
  const stateValue = url.searchParams.get("state") || ""
  const state = db
    .prepare(
      "SELECT * FROM instagram_oauth_states WHERE state = ? AND userId = ?",
    )
    .get(stateValue, user.id) as OAuthState | undefined

  if (!code || !state || state.expiresAt <= now()) {
    if (stateValue) {
      db.prepare("DELETE FROM instagram_oauth_states WHERE state = ?").run(
        stateValue,
      )
    }
    return dashboardRedirect(request, "invalid-state")
  }

  db.prepare("DELETE FROM instagram_oauth_states WHERE state = ?").run(
    state.state,
  )
  const model = db
    .prepare("SELECT * FROM wavespeed_models WHERE id = ? AND userId = ?")
    .get(state.wavespeedModelId, user.id) as WavespeedModelRecord | undefined
  if (!model) return dashboardRedirect(request, "missing-model")

  try {
    const token = await exchangeInstagramCode(code, url.origin)
    const profile = await getInstagramProfile(token.accessToken)
    const instagramUserId = String(
      profile.user_id || token.instagramUserId || profile.id,
    )
    const timestamp = now()
    const existing = db
      .prepare(
        `SELECT * FROM instagram_connections
         WHERE userId = ? AND (wavespeedModelId = ? OR instagramUserId = ?)
         ORDER BY updatedAt DESC LIMIT 1`,
      )
      .get(user.id, model.id, instagramUserId) as
      | InstagramConnectionRecord
      | undefined

    db.exec("BEGIN IMMEDIATE;")
    try {
      db.prepare(
        `DELETE FROM instagram_connections
         WHERE userId = ? AND (wavespeedModelId = ? OR instagramUserId = ?)`,
      ).run(user.id, model.id, instagramUserId)
      db.prepare(
        `INSERT INTO instagram_connections
         (id, userId, wavespeedModelId, instagramUserId, username, displayName,
          profilePictureUrl, accessTokenEncrypted, tokenExpiresAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        existing?.id || createId(),
        user.id,
        model.id,
        instagramUserId,
        profile.username,
        profile.name || null,
        profile.profile_picture_url || null,
        encryptInstagramToken(token.accessToken),
        token.expiresAt,
        existing?.createdAt || timestamp,
        timestamp,
      )
      db.exec("COMMIT;")
    } catch (error) {
      db.exec("ROLLBACK;")
      throw error
    }

    const redirect = new URL("/dashboard", request.url)
    redirect.searchParams.set("instagram", "connected")
    redirect.searchParams.set("model", model.id)
    return NextResponse.redirect(redirect)
  } catch (error) {
    return dashboardRedirect(
      request,
      "oauth-error",
      error instanceof Error ? error.message : "Instagram connection failed.",
    )
  }
}

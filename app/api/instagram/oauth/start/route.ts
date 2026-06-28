import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/app/lib/auth"
import { db, now, type WavespeedModelRecord } from "@/app/lib/db"
import { instagramConfig, instagramPublicUrl } from "@/app/lib/instagram"

export async function GET(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.redirect(instagramPublicUrl("/login", request))

  const requestUrl = new URL(request.url)
  const modelId = requestUrl.searchParams.get("modelId") || ""
  const model = db
    .prepare("SELECT * FROM wavespeed_models WHERE id = ? AND userId = ?")
    .get(modelId, user.id) as WavespeedModelRecord | undefined

  if (!model) {
    return NextResponse.redirect(
      instagramPublicUrl("/dashboard?instagram=missing-model", request),
    )
  }

  try {
    const config = instagramConfig(requestUrl.origin)
    const state = randomBytes(32).toString("base64url")
    const createdAt = now()
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString()

    db.prepare("DELETE FROM instagram_oauth_states WHERE expiresAt <= ?").run(
      createdAt,
    )
    db.prepare(
      `INSERT INTO instagram_oauth_states
       (state, userId, wavespeedModelId, expiresAt, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(state, user.id, model.id, expiresAt, createdAt)

    const authorizeUrl = new URL(
      `https://www.facebook.com/${process.env.INSTAGRAM_GRAPH_VERSION || "v25.0"}/dialog/oauth`,
    )
    authorizeUrl.searchParams.set("client_id", config.appId)
    authorizeUrl.searchParams.set("redirect_uri", config.redirectUri)
    authorizeUrl.searchParams.set("response_type", "code")
    authorizeUrl.searchParams.set("config_id", config.facebookLoginConfigId)
    authorizeUrl.searchParams.set("override_default_response_type", "true")
    authorizeUrl.searchParams.set("state", state)
    authorizeUrl.searchParams.set("auth_type", "rerequest")

    return NextResponse.redirect(authorizeUrl)
  } catch (error) {
    const redirect = instagramPublicUrl("/dashboard", request)
    redirect.searchParams.set("instagram", "config-error")
    redirect.searchParams.set(
      "message",
      error instanceof Error ? error.message : "Instagram is not configured.",
    )
    return NextResponse.redirect(redirect)
  }
}

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/app/lib/auth"
import { db, now, type WavespeedModelRecord } from "@/app/lib/db"
import {
  encryptInstagramToken,
  exchangeFacebookCode,
  getManagedInstagramAccounts,
  saveInstagramConnection,
} from "@/app/lib/instagram"

type OAuthState = {
  state: string
  userId: string
  wavespeedModelId: string
  payloadEncrypted: string | null
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

  const model = db
    .prepare("SELECT * FROM wavespeed_models WHERE id = ? AND userId = ?")
    .get(state.wavespeedModelId, user.id) as WavespeedModelRecord | undefined
  if (!model) return dashboardRedirect(request, "missing-model")

  try {
    const token = await exchangeFacebookCode(code, url.origin)
    const accounts = await getManagedInstagramAccounts(token.accessToken)
    if (!accounts.length) {
      db.prepare("DELETE FROM instagram_oauth_states WHERE state = ?").run(
        state.state,
      )
      return dashboardRedirect(
        request,
        "no-instagram-account",
        "No professional Instagram account linked to an accessible Facebook Page was found.",
      )
    }

    if (accounts.length === 1) {
      saveInstagramConnection({
        userId: user.id,
        wavespeedModelId: model.id,
        account: accounts[0],
        tokenExpiresAt: token.expiresAt,
      })
      db.prepare("DELETE FROM instagram_oauth_states WHERE state = ?").run(
        state.state,
      )
      const redirect = new URL("/dashboard", request.url)
      redirect.searchParams.set("instagram", "connected")
      redirect.searchParams.set("model", model.id)
      return NextResponse.redirect(redirect)
    }

    db.prepare(
      `UPDATE instagram_oauth_states
       SET payloadEncrypted = ?, expiresAt = ? WHERE state = ? AND userId = ?`,
    ).run(
      encryptInstagramToken(
        JSON.stringify({ accounts, tokenExpiresAt: token.expiresAt }),
      ),
      new Date(Date.now() + 10 * 60000).toISOString(),
      state.state,
      user.id,
    )
    const selectionUrl = new URL("/dashboard/instagram/select", request.url)
    selectionUrl.searchParams.set("state", state.state)
    return NextResponse.redirect(selectionUrl)
  } catch (error) {
    db.prepare("DELETE FROM instagram_oauth_states WHERE state = ?").run(
      state.state,
    )
    return dashboardRedirect(
      request,
      "oauth-error",
      error instanceof Error ? error.message : "Instagram connection failed.",
    )
  }
}

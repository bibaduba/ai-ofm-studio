import { NextResponse } from "next/server"
import { getCurrentUser } from "@/app/lib/auth"
import { db, now, type WavespeedModelRecord } from "@/app/lib/db"
import {
  encryptInstagramToken,
  exchangeFacebookCode,
  getManagedInstagramAccounts,
  instagramPublicUrl,
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
  const url = instagramPublicUrl("/dashboard", request)
  url.searchParams.set("instagram", status)
  if (message) url.searchParams.set("message", message)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.redirect(instagramPublicUrl("/login", request))

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
    const managedAccounts = await getManagedInstagramAccounts(
      token.accessToken,
    )
    const accounts = managedAccounts.accounts
    if (!accounts.length) {
      db.prepare("DELETE FROM instagram_oauth_states WHERE state = ?").run(
        state.state,
      )
      return dashboardRedirect(
        request,
        managedAccounts.pageCount
          ? "no-instagram-account"
          : "no-facebook-page",
        managedAccounts.pageCount
          ? "Meta returned Facebook Pages, but none has a linked professional Instagram account. Check Page Settings > Linked accounts."
          : "Meta returned no Facebook Pages. Reconnect and select the Page asset, then verify pages_show_list and full Page access.",
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
      const redirect = instagramPublicUrl("/dashboard", request)
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
    const selectionUrl = instagramPublicUrl(
      "/dashboard/instagram/select",
      request,
    )
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

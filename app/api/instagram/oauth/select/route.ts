import { NextResponse } from "next/server"
import { getCurrentUser } from "@/app/lib/auth"
import { db, now, type WavespeedModelRecord } from "@/app/lib/db"
import {
  decryptInstagramToken,
  saveInstagramConnection,
  type ManagedInstagramAccount,
} from "@/app/lib/instagram"

type OAuthState = {
  state: string
  userId: string
  wavespeedModelId: string
  payloadEncrypted: string | null
  expiresAt: string
}

type SelectionPayload = {
  accounts: ManagedInstagramAccount[]
  tokenExpiresAt: string | null
}

function getState(stateValue: string, userId: string) {
  return db
    .prepare(
      `SELECT * FROM instagram_oauth_states
       WHERE state = ? AND userId = ? AND expiresAt > ?`,
    )
    .get(stateValue, userId, now()) as OAuthState | undefined
}

function parsePayload(state: OAuthState) {
  if (!state.payloadEncrypted) throw new Error("OAuth selection has expired.")
  return JSON.parse(
    decryptInstagramToken(state.payloadEncrypted),
  ) as SelectionPayload
}

export async function GET(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const stateValue = new URL(request.url).searchParams.get("state") || ""
  const state = getState(stateValue, user.id)
  if (!state) {
    return NextResponse.json(
      { error: "Instagram account selection expired." },
      { status: 410 },
    )
  }

  try {
    const payload = parsePayload(state)
    const model = db
      .prepare("SELECT * FROM wavespeed_models WHERE id = ? AND userId = ?")
      .get(state.wavespeedModelId, user.id) as WavespeedModelRecord | undefined
    return NextResponse.json({
      model: model ? { id: model.id, name: model.name } : null,
      accounts: payload.accounts.map((account) => ({
        id: account.id,
        username: account.username,
        name: account.name || null,
        profilePictureUrl: account.profile_picture_url || null,
        facebookPageName: account.facebookPageName,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Selection failed." },
      { status: 400 },
    )
  }
}

export async function POST(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json()
  const stateValue = String(body.state || "")
  const instagramUserId = String(body.instagramUserId || "")
  const state = getState(stateValue, user.id)
  if (!state) {
    return NextResponse.json(
      { error: "Instagram account selection expired." },
      { status: 410 },
    )
  }

  try {
    const payload = parsePayload(state)
    const account = payload.accounts.find(
      (candidate) => candidate.id === instagramUserId,
    )
    if (!account) {
      return NextResponse.json(
        { error: "Instagram account is not available." },
        { status: 404 },
      )
    }
    const model = db
      .prepare("SELECT * FROM wavespeed_models WHERE id = ? AND userId = ?")
      .get(state.wavespeedModelId, user.id) as WavespeedModelRecord | undefined
    if (!model) {
      return NextResponse.json(
        { error: "Model not found." },
        { status: 404 },
      )
    }

    saveInstagramConnection({
      userId: user.id,
      wavespeedModelId: model.id,
      account,
      tokenExpiresAt: payload.tokenExpiresAt,
    })
    db.prepare("DELETE FROM instagram_oauth_states WHERE state = ?").run(
      state.state,
    )
    return NextResponse.json({ ok: true, modelId: model.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Selection failed." },
      { status: 400 },
    )
  }
}

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"
import { db, now, type InstagramConnectionRecord } from "@/app/lib/db"

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || "v25.0"
const GRAPH_HOST = "https://graph.instagram.com"

type InstagramErrorPayload = {
  error?: {
    message?: string
    type?: string
    code?: number
  }
}

export type InstagramProfile = {
  id: string
  user_id?: string
  username: string
  name?: string
  profile_picture_url?: string
  followers_count?: number
  media_count?: number
}

export function instagramConfig(origin?: string) {
  const appId = process.env.INSTAGRAM_APP_ID || ""
  const appSecret = process.env.INSTAGRAM_APP_SECRET || ""
  const appUrl = (process.env.APP_URL || origin || "").replace(/\/$/, "")
  const encryptionSecret =
    process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY || appSecret

  if (!appId || !appSecret || !appUrl || !encryptionSecret) {
    throw new Error(
      "Instagram OAuth is not configured. Add INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_TOKEN_ENCRYPTION_KEY and APP_URL.",
    )
  }

  return {
    appId,
    appSecret,
    appUrl,
    redirectUri: `${appUrl}/api/instagram/oauth/callback`,
    encryptionSecret,
  }
}

function encryptionKey() {
  const encryptionSecret =
    process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY ||
    process.env.INSTAGRAM_APP_SECRET
  if (!encryptionSecret) {
    throw new Error("Instagram token encryption key is not configured.")
  }
  return createHash("sha256")
    .update(encryptionSecret)
    .digest()
}

export function encryptInstagramToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return ["v1", iv, tag, encrypted]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url"),
    )
    .join(".")
}

export function decryptInstagramToken(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".")
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Stored Instagram token has an invalid format.")
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

async function instagramRequest<T>(url: URL, accessToken?: string) {
  const response = await fetch(url, {
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
    cache: "no-store",
  })
  const data = (await response.json()) as T & InstagramErrorPayload
  if (!response.ok || data.error) {
    throw new Error(
      data.error?.message || `Instagram API request failed (${response.status}).`,
    )
  }
  return data as T
}

export async function instagramGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | undefined> = {},
) {
  const normalizedPath = path.replace(/^\//, "")
  const url = new URL(`${GRAPH_HOST}/${GRAPH_VERSION}/${normalizedPath}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return instagramRequest<T>(url, accessToken)
}

export async function instagramGetUrl<T>(value: string, accessToken: string) {
  const url = new URL(value)
  if (url.hostname !== "graph.instagram.com") {
    throw new Error("Instagram returned an unexpected pagination URL.")
  }
  return instagramRequest<T>(url, accessToken)
}

export async function exchangeInstagramCode(code: string, origin: string) {
  const config = instagramConfig(origin)
  const body = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code,
  })
  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  const shortToken = (await response.json()) as InstagramErrorPayload & {
    access_token?: string
    user_id?: string | number
  }
  if (!response.ok || !shortToken.access_token) {
    throw new Error(
      shortToken.error?.message || "Instagram did not return an access token.",
    )
  }

  const longTokenUrl = new URL(`${GRAPH_HOST}/access_token`)
  longTokenUrl.searchParams.set("grant_type", "ig_exchange_token")
  longTokenUrl.searchParams.set("client_secret", config.appSecret)
  longTokenUrl.searchParams.set("access_token", shortToken.access_token)
  const longToken = await instagramRequest<{
    access_token: string
    token_type: string
    expires_in?: number
  }>(longTokenUrl)

  return {
    accessToken: longToken.access_token,
    instagramUserId: String(shortToken.user_id || ""),
    expiresAt: longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000).toISOString()
      : null,
  }
}

export async function getInstagramProfile(accessToken: string) {
  return instagramGet<InstagramProfile>("me", accessToken, {
    fields:
      "id,user_id,username,name,profile_picture_url,followers_count,media_count",
  })
}

export async function getUsableInstagramToken(
  connection: InstagramConnectionRecord,
) {
  const accessToken = decryptInstagramToken(connection.accessTokenEncrypted)
  const expiresAt = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt).getTime()
    : null

  if (!expiresAt || expiresAt - Date.now() > 7 * 86400000) return accessToken

  const refreshUrl = new URL(`${GRAPH_HOST}/refresh_access_token`)
  refreshUrl.searchParams.set("grant_type", "ig_refresh_token")
  refreshUrl.searchParams.set("access_token", accessToken)
  const refreshed = await instagramRequest<{
    access_token: string
    expires_in?: number
  }>(refreshUrl)
  const nextExpiry = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : connection.tokenExpiresAt

  db.prepare(
    `UPDATE instagram_connections
     SET accessTokenEncrypted = ?, tokenExpiresAt = ?, updatedAt = ?
     WHERE id = ?`,
  ).run(
    encryptInstagramToken(refreshed.access_token),
    nextExpiry,
    now(),
    connection.id,
  )
  return refreshed.access_token
}

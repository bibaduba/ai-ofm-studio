import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"
import {
  createId,
  db,
  now,
  type InstagramConnectionRecord,
} from "@/app/lib/db"

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || "v25.0"
const GRAPH_HOST = "https://graph.facebook.com"

type GraphErrorPayload = {
  error?: { message?: string; type?: string; code?: number }
}

export type InstagramProfile = {
  id: string
  username: string
  name?: string
  profile_picture_url?: string
  followers_count?: number
  media_count?: number
}

export type ManagedInstagramAccount = InstagramProfile & {
  facebookPageId: string
  facebookPageName: string
  pageAccessToken: string
}

export function instagramConfig(origin?: string) {
  const appId = process.env.INSTAGRAM_APP_ID || ""
  const appSecret = process.env.INSTAGRAM_APP_SECRET || ""
  const appUrl = (process.env.APP_URL || origin || "").replace(/\/$/, "")
  const encryptionSecret = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY || ""
  const missing = [
    !appId && "INSTAGRAM_APP_ID",
    !appSecret && "INSTAGRAM_APP_SECRET",
    !encryptionSecret && "INSTAGRAM_TOKEN_ENCRYPTION_KEY",
    !appUrl && "APP_URL",
  ].filter(Boolean)

  if (missing.length) {
    throw new Error(`Instagram OAuth is missing: ${missing.join(", ")}.`)
  }
  return {
    appId,
    appSecret,
    appUrl,
    redirectUri: `${appUrl}/api/instagram/oauth/callback`,
  }
}

function encryptionKey() {
  const secret = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY
  if (!secret) throw new Error("Instagram token encryption key is missing.")
  return createHash("sha256").update(secret).digest()
}

export function encryptInstagramToken(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ])
  return ["v1", iv, cipher.getAuthTag(), encrypted]
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

async function graphRequest<T>(url: URL, accessToken?: string) {
  const response = await fetch(url, {
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
    cache: "no-store",
  })
  const data = (await response.json()) as T & GraphErrorPayload
  if (!response.ok || data.error) {
    throw new Error(
      data.error?.message || `Meta Graph API failed (${response.status}).`,
    )
  }
  return data as T
}

export async function instagramGet<T>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | undefined> = {},
) {
  const url = new URL(
    `${GRAPH_HOST}/${GRAPH_VERSION}/${path.replace(/^\//, "")}`,
  )
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  return graphRequest<T>(url, accessToken)
}

export async function instagramGetUrl<T>(value: string, accessToken: string) {
  const url = new URL(value)
  if (url.hostname !== "graph.facebook.com") {
    throw new Error("Meta returned an unexpected pagination URL.")
  }
  return graphRequest<T>(url, accessToken)
}

export async function exchangeFacebookCode(code: string, origin: string) {
  const config = instagramConfig(origin)
  const tokenUrl = new URL(
    `${GRAPH_HOST}/${GRAPH_VERSION}/oauth/access_token`,
  )
  tokenUrl.searchParams.set("client_id", config.appId)
  tokenUrl.searchParams.set("client_secret", config.appSecret)
  tokenUrl.searchParams.set("redirect_uri", config.redirectUri)
  tokenUrl.searchParams.set("code", code)
  const shortToken = await graphRequest<{
    access_token: string
    token_type?: string
    expires_in?: number
  }>(tokenUrl)

  const longTokenUrl = new URL(
    `${GRAPH_HOST}/${GRAPH_VERSION}/oauth/access_token`,
  )
  longTokenUrl.searchParams.set("grant_type", "fb_exchange_token")
  longTokenUrl.searchParams.set("client_id", config.appId)
  longTokenUrl.searchParams.set("client_secret", config.appSecret)
  longTokenUrl.searchParams.set("fb_exchange_token", shortToken.access_token)
  const longToken = await graphRequest<{
    access_token: string
    token_type?: string
    expires_in?: number
  }>(longTokenUrl)

  return {
    accessToken: longToken.access_token,
    expiresAt: longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000).toISOString()
      : null,
  }
}

export async function getManagedInstagramAccounts(userAccessToken: string) {
  type Page = {
    id: string
    name: string
    access_token: string
    instagram_business_account?: InstagramProfile
  }
  type PagesResponse = { data: Page[]; paging?: { next?: string } }
  const response = await instagramGet<PagesResponse>(
    "me/accounts",
    userAccessToken,
    {
      fields:
        "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}",
      limit: 100,
    },
  )
  return response.data
    .filter(
      (page): page is Page & { instagram_business_account: InstagramProfile } =>
        Boolean(page.instagram_business_account?.id),
    )
    .map((page) => ({
      ...page.instagram_business_account,
      facebookPageId: page.id,
      facebookPageName: page.name,
      pageAccessToken: page.access_token,
    }))
}

export async function getInstagramProfile(
  instagramUserId: string,
  accessToken: string,
) {
  return instagramGet<InstagramProfile>(instagramUserId, accessToken, {
    fields:
      "id,username,name,profile_picture_url,followers_count,media_count",
  })
}

export function getUsableInstagramToken(
  connection: InstagramConnectionRecord,
) {
  if (
    connection.tokenExpiresAt &&
    new Date(connection.tokenExpiresAt).getTime() <= Date.now()
  ) {
    throw new Error("Meta access token expired. Reconnect Instagram.")
  }
  return decryptInstagramToken(connection.accessTokenEncrypted)
}

export function saveInstagramConnection(input: {
  userId: string
  wavespeedModelId: string
  account: ManagedInstagramAccount
  tokenExpiresAt: string | null
}) {
  const { userId, wavespeedModelId, account, tokenExpiresAt } = input
  const existing = db
    .prepare(
      `SELECT * FROM instagram_connections
       WHERE userId = ? AND (wavespeedModelId = ? OR instagramUserId = ?)
       ORDER BY updatedAt DESC LIMIT 1`,
    )
    .get(userId, wavespeedModelId, account.id) as
    | InstagramConnectionRecord
    | undefined
  const timestamp = now()

  db.exec("BEGIN IMMEDIATE;")
  try {
    db.prepare(
      `DELETE FROM instagram_connections
       WHERE userId = ? AND (wavespeedModelId = ? OR instagramUserId = ?)`,
    ).run(userId, wavespeedModelId, account.id)
    db.prepare(
      `INSERT INTO instagram_connections
       (id, userId, wavespeedModelId, instagramUserId, facebookPageId,
        username, displayName, profilePictureUrl, accessTokenEncrypted,
        tokenExpiresAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      existing?.id || createId(),
      userId,
      wavespeedModelId,
      account.id,
      account.facebookPageId,
      account.username,
      account.name || null,
      account.profile_picture_url || null,
      encryptInstagramToken(account.pageAccessToken),
      tokenExpiresAt,
      existing?.createdAt || timestamp,
      timestamp,
    )
    db.exec("COMMIT;")
  } catch (error) {
    db.exec("ROLLBACK;")
    throw error
  }
}

import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"

export type ProfileRecord = {
  id: string
  userId: string | null
  name: string
  createdAt: string
  updatedAt: string
}

export type GenerationRecord = {
  id: string
  profileId: string
  mediaType: string
  prompt: string
  imageData: string
  sourceImages: string | null
  model: string
  aspectRatio: string
  resolution: string
  favorite: number
  createdAt: string
}

export type WavespeedModelRecord = {
  id: string
  userId: string | null
  name: string
  faceReferences: string
  bodyReferences: string
  createdAt: string
  updatedAt: string
}

export type WavespeedGenerationRecord = {
  id: string
  userId: string | null
  wavespeedModelId: string | null
  mode: string
  prompt: string
  faceReferences: string | null
  bodyReferences: string | null
  sceneReference: string | null
  resultImages: string
  status: string
  predictionId: string | null
  endpoint: string | null
  requestData: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export type InstagramConnectionRecord = {
  id: string
  userId: string
  wavespeedModelId: string
  instagramUserId: string
  facebookPageId: string | null
  username: string
  displayName: string | null
  profilePictureUrl: string | null
  accessTokenEncrypted: string
  tokenExpiresAt: string | null
  createdAt: string
  updatedAt: string
}

const globalForDb = globalThis as unknown as { sqliteDb?: DatabaseSync }

function initializeDatabase() {
  if (globalForDb.sqliteDb) return globalForDb.sqliteDb

  const dataDirectory = process.env.DATA_DIR || join(process.cwd(), "data")
  const dbPath = join(dataDirectory, "studio.db")
  mkdirSync(dirname(dbPath), { recursive: true })

  const database = new DatabaseSync(dbPath)
  database.exec("PRAGMA busy_timeout = 30000;")
  database.exec("PRAGMA journal_mode = WAL;")
  database.exec("PRAGMA foreign_keys = ON;")

  database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    passwordHash TEXT NOT NULL,
    passwordSalt TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    tokenHash TEXT NOT NULL UNIQUE,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(tokenHash);
  CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expiresAt);

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    profileId TEXT NOT NULL,
    mediaType TEXT NOT NULL DEFAULT 'image',
    prompt TEXT NOT NULL,
    imageData TEXT NOT NULL,
    sourceImages TEXT,
    model TEXT NOT NULL,
    aspectRatio TEXT NOT NULL,
    resolution TEXT NOT NULL,
    favorite INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS generations_profile_created_idx
    ON generations(profileId, createdAt DESC);

  CREATE TABLE IF NOT EXISTS wavespeed_models (
    id TEXT PRIMARY KEY,
    userId TEXT,
    name TEXT NOT NULL,
    faceReferences TEXT NOT NULL,
    bodyReferences TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wavespeed_generations (
    id TEXT PRIMARY KEY,
    userId TEXT,
    wavespeedModelId TEXT,
    mode TEXT NOT NULL,
    prompt TEXT NOT NULL,
    faceReferences TEXT,
    bodyReferences TEXT,
    sceneReference TEXT,
    resultImages TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    predictionId TEXT,
    endpoint TEXT,
    requestData TEXT,
    error TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (wavespeedModelId) REFERENCES wavespeed_models(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS wavespeed_generations_created_idx
    ON wavespeed_generations(createdAt DESC);

  CREATE TABLE IF NOT EXISTS instagram_connections (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    wavespeedModelId TEXT NOT NULL UNIQUE,
    instagramUserId TEXT NOT NULL,
    facebookPageId TEXT,
    username TEXT NOT NULL,
    displayName TEXT,
    profilePictureUrl TEXT,
    accessTokenEncrypted TEXT NOT NULL,
    tokenExpiresAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    UNIQUE(userId, instagramUserId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (wavespeedModelId) REFERENCES wavespeed_models(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS instagram_oauth_states (
    state TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    wavespeedModelId TEXT NOT NULL,
    payloadEncrypted TEXT,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (wavespeedModelId) REFERENCES wavespeed_models(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS instagram_connections_user_idx
    ON instagram_connections(userId, updatedAt DESC);
  CREATE INDEX IF NOT EXISTS instagram_oauth_states_expires_idx
    ON instagram_oauth_states(expiresAt);
  `)

  const profileColumns = database
    .prepare("PRAGMA table_info(profiles)")
    .all() as Array<{ name: string }>

  if (!profileColumns.some((column) => column.name === "userId")) {
    database.exec("ALTER TABLE profiles ADD COLUMN userId TEXT;")
  }

  const wavespeedModelColumns = database
    .prepare("PRAGMA table_info(wavespeed_models)")
    .all() as Array<{ name: string }>

  if (!wavespeedModelColumns.some((column) => column.name === "userId")) {
    database.exec("ALTER TABLE wavespeed_models ADD COLUMN userId TEXT;")
  }

  const instagramConnectionColumns = database
    .prepare("PRAGMA table_info(instagram_connections)")
    .all() as Array<{ name: string }>
  if (
    !instagramConnectionColumns.some(
      (column) => column.name === "facebookPageId",
    )
  ) {
    database.exec(
      "ALTER TABLE instagram_connections ADD COLUMN facebookPageId TEXT;",
    )
  }

  const instagramOAuthStateColumns = database
    .prepare("PRAGMA table_info(instagram_oauth_states)")
    .all() as Array<{ name: string }>
  if (
    !instagramOAuthStateColumns.some(
      (column) => column.name === "payloadEncrypted",
    )
  ) {
    database.exec(
      "ALTER TABLE instagram_oauth_states ADD COLUMN payloadEncrypted TEXT;",
    )
  }

  const generationColumns = database
    .prepare("PRAGMA table_info(generations)")
    .all() as Array<{ name: string }>

  if (!generationColumns.some((column) => column.name === "mediaType")) {
    database.exec(
      "ALTER TABLE generations ADD COLUMN mediaType TEXT NOT NULL DEFAULT 'image';",
    )
  }

  const wavespeedGenerationColumns = database
    .prepare("PRAGMA table_info(wavespeed_generations)")
    .all() as Array<{ name: string }>

  if (!wavespeedGenerationColumns.some((column) => column.name === "userId")) {
    database.exec("ALTER TABLE wavespeed_generations ADD COLUMN userId TEXT;")
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS profiles_user_updated_idx
      ON profiles(userId, updatedAt DESC);
    CREATE INDEX IF NOT EXISTS wavespeed_models_user_updated_idx
      ON wavespeed_models(userId, updatedAt DESC);
    CREATE INDEX IF NOT EXISTS wavespeed_generations_user_created_idx
      ON wavespeed_generations(userId, createdAt DESC);
  `)

  if (
    wavespeedGenerationColumns.length > 0 &&
    !wavespeedGenerationColumns.some(
      (column) => column.name === "faceReferences",
    )
  ) {
    database.exec(
      "ALTER TABLE wavespeed_generations ADD COLUMN faceReferences TEXT;",
    )
  }

  if (
    wavespeedGenerationColumns.length > 0 &&
    !wavespeedGenerationColumns.some(
      (column) => column.name === "bodyReferences",
    )
  ) {
    database.exec(
      "ALTER TABLE wavespeed_generations ADD COLUMN bodyReferences TEXT;",
    )
  }

  if (
    wavespeedGenerationColumns.length > 0 &&
    !wavespeedGenerationColumns.some((column) => column.name === "status")
  ) {
    database.exec(
      "ALTER TABLE wavespeed_generations ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';",
    )
  }

  if (
    wavespeedGenerationColumns.length > 0 &&
    !wavespeedGenerationColumns.some((column) => column.name === "predictionId")
  ) {
    database.exec(
      "ALTER TABLE wavespeed_generations ADD COLUMN predictionId TEXT;",
    )
  }

  if (
    wavespeedGenerationColumns.length > 0 &&
    !wavespeedGenerationColumns.some((column) => column.name === "endpoint")
  ) {
    database.exec("ALTER TABLE wavespeed_generations ADD COLUMN endpoint TEXT;")
  }

  if (
    wavespeedGenerationColumns.length > 0 &&
    !wavespeedGenerationColumns.some((column) => column.name === "error")
  ) {
    database.exec("ALTER TABLE wavespeed_generations ADD COLUMN error TEXT;")
  }

  if (
    wavespeedGenerationColumns.length > 0 &&
    !wavespeedGenerationColumns.some((column) => column.name === "requestData")
  ) {
    database.exec(
      "ALTER TABLE wavespeed_generations ADD COLUMN requestData TEXT;",
    )
  }

  if (
    wavespeedGenerationColumns.length > 0 &&
    !wavespeedGenerationColumns.some((column) => column.name === "updatedAt")
  ) {
    database.exec(
      "ALTER TABLE wavespeed_generations ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '';",
    )
    database.exec(
      "UPDATE wavespeed_generations SET updatedAt = createdAt WHERE updatedAt = '';",
    )
  }

  globalForDb.sqliteDb = database
  return database
}

export const db = new Proxy({} as DatabaseSync, {
  get(_target, property) {
    const database = initializeDatabase()
    const value = Reflect.get(database, property)
    return typeof value === "function" ? value.bind(database) : value
  },
})

export function createId() {
  return crypto.randomUUID()
}

export function now() {
  return new Date().toISOString()
}

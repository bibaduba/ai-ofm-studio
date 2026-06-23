import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type ProfileRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type GenerationRecord = {
  id: string;
  profileId: string;
  mediaType: string;
  prompt: string;
  imageData: string;
  sourceImages: string | null;
  model: string;
  aspectRatio: string;
  resolution: string;
  favorite: number;
  createdAt: string;
};

export type WavespeedModelRecord = {
  id: string;
  name: string;
  faceReferences: string;
  bodyReferences: string;
  createdAt: string;
  updatedAt: string;
};

export type WavespeedGenerationRecord = {
  id: string;
  wavespeedModelId: string | null;
  mode: string;
  prompt: string;
  faceReferences: string | null;
  bodyReferences: string | null;
  sceneReference: string | null;
  resultImages: string;
  status: string;
  predictionId: string | null;
  endpoint: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

const dataDirectory = process.env.DATA_DIR || join(process.cwd(), "data");
const dbPath = join(dataDirectory, "studio.db");
mkdirSync(dirname(dbPath), { recursive: true });

const globalForDb = globalThis as unknown as { sqliteDb?: DatabaseSync };

export const db = globalForDb.sqliteDb ?? new DatabaseSync(dbPath);

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqliteDb = db;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
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
    name TEXT NOT NULL,
    faceReferences TEXT NOT NULL,
    bodyReferences TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wavespeed_generations (
    id TEXT PRIMARY KEY,
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
    error TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (wavespeedModelId) REFERENCES wavespeed_models(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS wavespeed_generations_created_idx
    ON wavespeed_generations(createdAt DESC);
`);

const generationColumns = db
  .prepare("PRAGMA table_info(generations)")
  .all() as Array<{ name: string }>;

if (!generationColumns.some((column) => column.name === "mediaType")) {
  db.exec("ALTER TABLE generations ADD COLUMN mediaType TEXT NOT NULL DEFAULT 'image';");
}

const wavespeedGenerationColumns = db
  .prepare("PRAGMA table_info(wavespeed_generations)")
  .all() as Array<{ name: string }>;

if (
  wavespeedGenerationColumns.length > 0 &&
  !wavespeedGenerationColumns.some((column) => column.name === "faceReferences")
) {
  db.exec("ALTER TABLE wavespeed_generations ADD COLUMN faceReferences TEXT;");
}

if (
  wavespeedGenerationColumns.length > 0 &&
  !wavespeedGenerationColumns.some((column) => column.name === "bodyReferences")
) {
  db.exec("ALTER TABLE wavespeed_generations ADD COLUMN bodyReferences TEXT;");
}

if (
  wavespeedGenerationColumns.length > 0 &&
  !wavespeedGenerationColumns.some((column) => column.name === "status")
) {
  db.exec("ALTER TABLE wavespeed_generations ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';");
}

if (
  wavespeedGenerationColumns.length > 0 &&
  !wavespeedGenerationColumns.some((column) => column.name === "predictionId")
) {
  db.exec("ALTER TABLE wavespeed_generations ADD COLUMN predictionId TEXT;");
}

if (
  wavespeedGenerationColumns.length > 0 &&
  !wavespeedGenerationColumns.some((column) => column.name === "endpoint")
) {
  db.exec("ALTER TABLE wavespeed_generations ADD COLUMN endpoint TEXT;");
}

if (
  wavespeedGenerationColumns.length > 0 &&
  !wavespeedGenerationColumns.some((column) => column.name === "error")
) {
  db.exec("ALTER TABLE wavespeed_generations ADD COLUMN error TEXT;");
}

if (
  wavespeedGenerationColumns.length > 0 &&
  !wavespeedGenerationColumns.some((column) => column.name === "updatedAt")
) {
  db.exec("ALTER TABLE wavespeed_generations ADD COLUMN updatedAt TEXT NOT NULL DEFAULT '';");
  db.exec("UPDATE wavespeed_generations SET updatedAt = createdAt WHERE updatedAt = '';");
}

export function createId() {
  return crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
}

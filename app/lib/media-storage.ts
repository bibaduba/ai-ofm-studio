import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

function mediaRoot() {
  return join(process.env.DATA_DIR || join(process.cwd(), "data"), "media");
}

function extensionFor(contentType: string, source: string) {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  const byType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm"
  };
  if (byType[normalized]) return byType[normalized];
  const sourceExtension = extname(new URL(source).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".mov", ".webm"].includes(sourceExtension)
    ? sourceExtension
    : ".bin";
}

export function persistedMediaPath(userId: string, filename: string) {
  const safeFilename = basename(filename);
  if (!safeFilename || safeFilename !== filename) return null;
  return join(mediaRoot(), userId, safeFilename);
}

function localMediaUrl(userId: string, filename: string) {
  return `/api/media/${encodeURIComponent(userId)}/${encodeURIComponent(filename)}`;
}

export async function persistWavespeedOutputs(
  userId: string,
  generationId: string,
  outputs: string[]
) {
  const directory = join(mediaRoot(), userId);
  await mkdir(directory, { recursive: true });

  return Promise.all(outputs.map(async (source, index) => {
    if (!/^https?:\/\//i.test(source)) return source;

    try {
      const response = await fetch(source, {
        headers: { "User-Agent": "AI-OFM-Studio/1.0" },
        redirect: "follow"
      });
      if (response.status === 403 || response.status === 404) {
        return `expired:wavespeed:${generationId}:${index + 1}`;
      }
      if (!response.ok) return source;

      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (declaredSize > MAX_MEDIA_BYTES) return source;

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_MEDIA_BYTES) return source;

      const extension = extensionFor(response.headers.get("content-type") || "", source);
      const filename = `${generationId}-${index + 1}-${crypto.randomUUID()}${extension}`;
      const finalPath = join(directory, filename);
      const temporaryPath = `${finalPath}.tmp`;
      await writeFile(temporaryPath, buffer);
      await rename(temporaryPath, finalPath);
      return localMediaUrl(userId, filename);
    } catch {
      return source;
    }
  }));
}

export async function deletePersistedMedia(userId: string, outputs: string[]) {
  await Promise.all(outputs.map(async (source) => {
    const prefix = `/api/media/${encodeURIComponent(userId)}/`;
    if (!source.startsWith(prefix)) return;
    const filename = decodeURIComponent(source.slice(prefix.length));
    const path = persistedMediaPath(userId, filename);
    if (path) await rm(path, { force: true }).catch(() => undefined);
  }));
}

export async function mediaAsDataUrl(userId: string, source: string) {
  const prefix = `/api/media/${encodeURIComponent(userId)}/`;
  if (!source.startsWith(prefix)) return source;
  const filename = decodeURIComponent(source.slice(prefix.length));
  const path = persistedMediaPath(userId, filename);
  if (!path) return source;

  try {
    const buffer = await readFile(path);
    const extension = extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
      ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4",
      ".mov": "video/quicktime", ".webm": "video/webm"
    };
    return `data:${mimeTypes[extension] || "application/octet-stream"};base64,${buffer.toString("base64")}`;
  } catch {
    return source;
  }
}

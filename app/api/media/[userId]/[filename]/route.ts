import { readFile, stat } from "node:fs/promises"
import { extname } from "node:path"
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/app/lib/auth"
import { persistedMediaPath } from "@/app/lib/media-storage"

export async function GET(
  _request: Request,
  { params }: { params: { userId: string; filename: string } },
) {
  const user = getCurrentUser()
  if (!user || user.id !== params.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const path = persistedMediaPath(user.id, params.filename)
  if (!path)
    return NextResponse.json({ error: "Media not found." }, { status: 404 })

  try {
    const fileStat = await stat(path)
    if (!fileStat.isFile()) throw new Error("Not a file")
    const file = await readFile(path)
    const extension = extname(params.filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
    }
    return new Response(file, {
      headers: {
        "Content-Type": mimeTypes[extension] || "application/octet-stream",
        "Content-Length": String(file.length),
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    })
  } catch {
    return NextResponse.json({ error: "Media not found." }, { status: 404 })
  }
}

import { NextResponse } from "next/server"
import {
  createId,
  db,
  now,
  type WavespeedGenerationRecord,
  type WavespeedModelRecord,
} from "@/app/lib/db"
import {
  checkWavespeedPrediction,
  startWavespeedMotionPrediction,
  startWavespeedPrediction,
} from "@/app/lib/wavespeed"
import { getCurrentUser } from "@/app/lib/auth"
import {
  deletePersistedMedia,
  persistWavespeedOutputs,
} from "@/app/lib/media-storage"

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function normalizeStatus(value: string, hasOutputs = false) {
  const status = value.toLowerCase()
  if (
    hasOutputs ||
    ["completed", "succeeded", "success", "finished"].includes(status)
  )
    return "completed"
  if (["failed", "error", "canceled", "cancelled"].includes(status))
    return "failed"
  return status || "running"
}

function getGeneration(id: string, userId: string) {
  return db
    .prepare("SELECT * FROM wavespeed_generations WHERE id = ? AND userId = ?")
    .get(id, userId) as WavespeedGenerationRecord | undefined
}

function resultUrls(generation: WavespeedGenerationRecord) {
  try {
    const parsed = JSON.parse(generation.resultImages)
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : []
  } catch {
    return []
  }
}

export async function GET() {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const generations = db
    .prepare(
      "SELECT * FROM wavespeed_generations WHERE userId = ? ORDER BY createdAt DESC LIMIT 50",
    )
    .all(user.id) as WavespeedGenerationRecord[]

  const legacyRemoteGenerations = generations
    .filter(
      (generation) =>
        generation.status === "completed" &&
        resultUrls(generation).some((url) => /^https?:\/\//i.test(url)),
    )
    .slice(0, 12)

  await Promise.all(
    legacyRemoteGenerations.map(async (generation) => {
      const original = resultUrls(generation)
      const persisted = await persistWavespeedOutputs(
        user.id,
        generation.id,
        original,
      )
      if (persisted.some((url, index) => url !== original[index])) {
        generation.resultImages = JSON.stringify(persisted)
        db.prepare(
          "UPDATE wavespeed_generations SET resultImages = ?, updatedAt = ? WHERE id = ? AND userId = ?",
        ).run(generation.resultImages, now(), generation.id, user.id)
      }
    }),
  )

  return NextResponse.json(generations)
}

export async function POST(request: Request) {
  try {
    const user = getCurrentUser()
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await request.json()

    const apiKey = String(body.apiKey || "")
    const endpoint = String(body.endpoint || "")
    const mode =
      body.mode === "scene"
        ? "scene"
        : body.mode === "motion"
          ? "motion"
          : "model"
    const wavespeedModelId = body.wavespeedModelId
      ? String(body.wavespeedModelId)
      : null
    const modelName = String(body.modelName || "")
    const prompt = String(body.prompt || "").trim()
    const count = Number(body.count)
    let faceReferences = Array.isArray(body.faceReferences)
      ? body.faceReferences.slice(0, 2)
      : []
    let bodyReferences = Array.isArray(body.bodyReferences)
      ? body.bodyReferences.slice(0, 2)
      : []
    const sceneReference = body.sceneReference
      ? String(body.sceneReference)
      : null
    const motionImage = body.image ? String(body.image) : null
    const motionVideo = body.video ? String(body.video) : null
    const negativePrompt = String(body.negativePrompt || "")
    const characterOrientation =
      body.characterOrientation === "video" ? "video" : "image"
    const keepOriginalSound = body.keepOriginalSound !== false

    if (wavespeedModelId) {
      const savedModel = db
        .prepare("SELECT * FROM wavespeed_models WHERE id = ? AND userId = ?")
        .get(wavespeedModelId, user.id) as WavespeedModelRecord | undefined
      if (!savedModel) {
        return NextResponse.json(
          { error: "Saved Wavespeed model not found." },
          { status: 404 },
        )
      }
      faceReferences = JSON.parse(savedModel.faceReferences) as string[]
      bodyReferences = JSON.parse(savedModel.bodyReferences) as string[]
    }

    if (mode !== "motion" && !prompt) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 },
      )
    }
    if (mode !== "motion" && (!Number.isInteger(count) || count < 1)) {
      return NextResponse.json(
        { error: "count must be a positive integer." },
        { status: 400 },
      )
    }
    if (mode === "motion" && !motionImage && !motionVideo) {
      return NextResponse.json(
        { error: "Image or video reference is required for motion control." },
        { status: 400 },
      )
    }
    if (!apiKey || !endpoint) {
      return NextResponse.json(
        {
          error:
            "Wavespeed API key and endpoint are required unless Demo mode is enabled.",
        },
        { status: 400 },
      )
    }

    const generationId = createId()
    const timestamp = now()
    const references =
      mode === "motion"
        ? [motionImage, motionVideo].filter(Boolean)
        : [
            ...faceReferences,
            ...bodyReferences,
            ...(sceneReference ? [sceneReference] : []),
          ]
    const requestData = JSON.stringify({
      mode,
      modelName,
      wavespeedModelId,
      endpoint,
      prompt,
      count,
      negativePrompt,
      characterOrientation,
      keepOriginalSound,
    })
    const generation = {
      id: generationId,
      userId: user.id,
      wavespeedModelId,
      mode,
      prompt,
      faceReferences: JSON.stringify(mode === "motion" ? [] : faceReferences),
      bodyReferences: JSON.stringify(
        mode === "motion" && motionVideo ? [motionVideo] : bodyReferences,
      ),
      sceneReference: mode === "motion" ? motionImage : sceneReference,
      resultImages: "[]",
      status: "pending",
      predictionId: null as string | null,
      endpoint,
      requestData,
      error: null as string | null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    db.prepare(
      `INSERT INTO wavespeed_generations
        (id, userId, wavespeedModelId, mode, prompt, faceReferences, bodyReferences, sceneReference, resultImages, status, predictionId, endpoint, requestData, error, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      generation.id,
      generation.userId,
      generation.wavespeedModelId,
      generation.mode,
      generation.prompt,
      generation.faceReferences,
      generation.bodyReferences,
      generation.sceneReference,
      generation.resultImages,
      generation.status,
      generation.predictionId,
      generation.endpoint,
      generation.requestData,
      generation.error,
      generation.createdAt,
      generation.updatedAt,
    )

    try {
      if (mode === "motion") {
        const prediction = await startWavespeedMotionPrediction({
          apiKey,
          endpoint,
          image: motionImage || undefined,
          video: motionVideo || undefined,
          characterOrientation,
          prompt,
          negativePrompt,
          keepOriginalSound,
        })
        const status = normalizeStatus(
          prediction.status,
          prediction.outputs.length > 0,
        )
        const persistedOutputs =
          prediction.outputs.length > 0
            ? await persistWavespeedOutputs(
                user.id,
                generation.id,
                prediction.outputs,
              )
            : prediction.outputs
        db.prepare(
          `UPDATE wavespeed_generations
           SET status = ?, predictionId = ?, resultImages = ?, error = ?, updatedAt = ?
           WHERE id = ?`,
        ).run(
          status,
          prediction.id || null,
          JSON.stringify(persistedOutputs),
          status === "failed"
            ? "Wavespeed provider rejected the motion request. Check image/video and prompt."
            : null,
          now(),
          generation.id,
        )
      } else {
        const prediction = await startWavespeedPrediction({
          apiKey,
          endpoint,
          prompt,
          images: references,
          count,
        })
        const status = normalizeStatus(
          prediction.status,
          prediction.outputs.length > 0,
        )
        const persistedOutputs =
          prediction.outputs.length > 0
            ? await persistWavespeedOutputs(
                user.id,
                generation.id,
                prediction.outputs,
              )
            : prediction.outputs
        db.prepare(
          `UPDATE wavespeed_generations
           SET status = ?, predictionId = ?, resultImages = ?, error = ?, updatedAt = ?
           WHERE id = ?`,
        ).run(
          status,
          prediction.id || null,
          JSON.stringify(persistedOutputs),
          status === "failed"
            ? "Wavespeed provider rejected the request. Check images and prompt."
            : null,
          now(),
          generation.id,
        )
      }
    } catch (error) {
      db.prepare(
        "UPDATE wavespeed_generations SET status = ?, error = ?, updatedAt = ? WHERE id = ?",
      ).run(
        "failed",
        error instanceof Error ? error.message : "Wavespeed generation failed.",
        now(),
        generation.id,
      )
    }

    return NextResponse.json(getGeneration(generation.id, user.id))
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Wavespeed generation failed.",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const user = getCurrentUser()
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const id = String(body.id || "")
    const apiKey = String(body.apiKey || "")

    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 })
    }

    const generation = getGeneration(id, user.id)
    if (!generation) {
      return NextResponse.json(
        { error: "Generation not found." },
        { status: 404 },
      )
    }

    if (generation.status === "completed" || generation.status === "failed") {
      return NextResponse.json(generation)
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "Wavespeed API key is required to check pending generation." },
        { status: 400 },
      )
    }

    if (!generation.predictionId || !generation.endpoint) {
      const timestamp = now()
      db.prepare(
        "UPDATE wavespeed_generations SET status = ?, error = ?, updatedAt = ? WHERE id = ?",
      ).run(
        "failed",
        "Pending generation has no Wavespeed prediction id.",
        timestamp,
        id,
      )
      return NextResponse.json(getGeneration(id, user.id))
    }

    const result = await checkWavespeedPrediction({
      apiKey,
      endpoint: generation.endpoint,
      predictionId: generation.predictionId,
    })
    const status = normalizeStatus(result.status, result.outputs.length > 0)
    const timestamp = now()
    const persistedOutputs =
      result.outputs.length > 0
        ? await persistWavespeedOutputs(user.id, generation.id, result.outputs)
        : result.outputs

    db.prepare(
      `UPDATE wavespeed_generations
       SET status = ?, resultImages = ?, error = ?, updatedAt = ?
       WHERE id = ?`,
    ).run(
      status,
      persistedOutputs.length > 0
        ? JSON.stringify(persistedOutputs)
        : generation.resultImages,
      status === "failed"
        ? result.error || "Wavespeed provider rejected the request."
        : null,
      timestamp,
      id,
    )

    return NextResponse.json(getGeneration(id, user.id))
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Wavespeed status check failed.",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 })
  }

  const generation = getGeneration(id, user.id)
  if (!generation)
    return NextResponse.json(
      { error: "Generation not found." },
      { status: 404 },
    )

  db.prepare(
    "DELETE FROM wavespeed_generations WHERE id = ? AND userId = ?",
  ).run(id, user.id)
  await deletePersistedMedia(user.id, resultUrls(generation))
  return NextResponse.json({ ok: true })
}

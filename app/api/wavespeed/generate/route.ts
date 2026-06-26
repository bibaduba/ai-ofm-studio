import { NextResponse } from "next/server";
import {
  createId,
  db,
  now,
  type WavespeedGenerationRecord,
  type WavespeedModelRecord
} from "@/app/lib/db";
import {
  checkWavespeedPrediction,
  startWavespeedMotionPrediction,
  startWavespeedPrediction
} from "@/app/lib/wavespeed";
import { getCurrentUser } from "@/app/lib/auth";

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mockImage(prompt: string, index: number) {
  const trimmed = prompt.replace(/\s+/g, " ").slice(0, 170);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1280" viewBox="0 0 1024 1280">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fff6fa"/>
          <stop offset="0.55" stop-color="#ffd3e6"/>
          <stop offset="1" stop-color="#ffffff"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1280" fill="url(#bg)"/>
      <rect x="70" y="70" width="884" height="1140" rx="54" fill="rgba(255,255,255,0.58)" stroke="#111" stroke-opacity="0.14"/>
      <circle cx="512" cy="365" r="150" fill="#111" opacity="0.08"/>
      <rect x="360" y="530" width="304" height="420" rx="150" fill="#ec0071" opacity="0.18"/>
      <text x="96" y="145" font-size="34" font-weight="900" fill="#ec0071">Wavespeed demo ${index}</text>
      <text x="96" y="204" font-size="22" fill="#111" opacity="0.72">AI Instagram model workflow mock</text>
      <text x="96" y="1040" font-size="24" fill="#111">${escapeSvgText(trimmed)}</text>
      <text x="96" y="1110" font-size="18" fill="#111" opacity="0.5">No provider request was sent.</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function normalizeStatus(value: string, hasOutputs = false) {
  const status = value.toLowerCase();
  if (hasOutputs || ["completed", "succeeded", "success", "finished"].includes(status)) return "completed";
  if (["failed", "error", "canceled", "cancelled"].includes(status)) return "failed";
  return status || "running";
}

function getGeneration(id: string, userId: string) {
  return db
    .prepare("SELECT * FROM wavespeed_generations WHERE id = ? AND userId = ?")
    .get(id, userId) as WavespeedGenerationRecord | undefined;
}

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const generations = db
    .prepare("SELECT * FROM wavespeed_generations WHERE userId = ? ORDER BY createdAt DESC LIMIT 50")
    .all(user.id) as WavespeedGenerationRecord[];

  return NextResponse.json(generations);
}

export async function POST(request: Request) {
  try {
    const user = getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();

    const mock = Boolean(body.mock);
    const apiKey = String(body.apiKey || "");
    const endpoint = String(body.endpoint || "");
    const mode = body.mode === "scene" ? "scene" : body.mode === "motion" ? "motion" : "model";
    const wavespeedModelId = body.wavespeedModelId ? String(body.wavespeedModelId) : null;
    const prompt = String(body.prompt || "").trim();
    const count = Number(body.count);
    let faceReferences = Array.isArray(body.faceReferences) ? body.faceReferences.slice(0, 2) : [];
    let bodyReferences = Array.isArray(body.bodyReferences) ? body.bodyReferences.slice(0, 2) : [];
    const sceneReference = body.sceneReference ? String(body.sceneReference) : null;
    const motionImage = body.image ? String(body.image) : null;
    const motionVideo = body.video ? String(body.video) : null;
    const negativePrompt = String(body.negativePrompt || "");
    const characterOrientation = body.characterOrientation === "video" ? "video" : "image";
    const keepOriginalSound = body.keepOriginalSound !== false;

    if (wavespeedModelId) {
      const savedModel = db
        .prepare("SELECT * FROM wavespeed_models WHERE id = ? AND userId = ?")
        .get(wavespeedModelId, user.id) as WavespeedModelRecord | undefined;
      if (!savedModel) {
        return NextResponse.json({ error: "Saved Wavespeed model not found." }, { status: 404 });
      }
      faceReferences = JSON.parse(savedModel.faceReferences) as string[];
      bodyReferences = JSON.parse(savedModel.bodyReferences) as string[];
    }

    if (mode !== "motion" && !prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }
    if (mode !== "motion" && (!Number.isInteger(count) || count < 1)) {
      return NextResponse.json({ error: "count must be a positive integer." }, { status: 400 });
    }
    if (mode === "motion" && !motionImage && !motionVideo) {
      return NextResponse.json({ error: "Image or video reference is required for motion control." }, { status: 400 });
    }
    if (!mock && (!apiKey || !endpoint)) {
      return NextResponse.json(
        { error: "Wavespeed API key and endpoint are required unless Demo mode is enabled." },
        { status: 400 }
      );
    }

    const generationId = createId();
    const timestamp = now();
    const references =
      mode === "motion"
        ? [motionImage, motionVideo].filter(Boolean)
        : [...faceReferences, ...bodyReferences, ...(sceneReference ? [sceneReference] : [])];
    const generation = {
      id: generationId,
      userId: user.id,
      wavespeedModelId,
      mode,
      prompt,
      faceReferences: JSON.stringify(mode === "motion" ? [] : faceReferences),
      bodyReferences: JSON.stringify(mode === "motion" && motionVideo ? [motionVideo] : bodyReferences),
      sceneReference: mode === "motion" ? motionImage : sceneReference,
      resultImages: "[]",
      status: "pending",
      predictionId: null as string | null,
      endpoint: mock ? null : endpoint,
      error: null as string | null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    db.prepare(
      `INSERT INTO wavespeed_generations
        (id, userId, wavespeedModelId, mode, prompt, faceReferences, bodyReferences, sceneReference, resultImages, status, predictionId, endpoint, error, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      generation.error,
      generation.createdAt,
      generation.updatedAt
    );

    try {
      if (mock) {
        const resultImages = Array.from(
          { length: mode === "motion" ? 1 : count },
          (_, index) => mockImage(prompt || "Video motion control demo", index + 1)
        );
        db.prepare(
          `UPDATE wavespeed_generations
           SET status = ?, resultImages = ?, updatedAt = ?
           WHERE id = ?`
        ).run("completed", JSON.stringify(resultImages), now(), generation.id);
      } else if (mode === "motion") {
        const prediction = await startWavespeedMotionPrediction({
          apiKey,
          endpoint,
          image: motionImage || undefined,
          video: motionVideo || undefined,
          characterOrientation,
          prompt,
          negativePrompt,
          keepOriginalSound
        });
        const status = normalizeStatus(prediction.status, prediction.outputs.length > 0);
        db.prepare(
          `UPDATE wavespeed_generations
           SET status = ?, predictionId = ?, resultImages = ?, error = ?, updatedAt = ?
           WHERE id = ?`
        ).run(
          status,
          prediction.id || null,
          JSON.stringify(prediction.outputs),
          status === "failed" ? "Wavespeed provider rejected the motion request. Check image/video and prompt." : null,
          now(),
          generation.id
        );
      } else {
        const prediction = await startWavespeedPrediction({
          apiKey,
          endpoint,
          prompt,
          images: references,
          count
        });
        const status = normalizeStatus(prediction.status, prediction.outputs.length > 0);
        db.prepare(
          `UPDATE wavespeed_generations
           SET status = ?, predictionId = ?, resultImages = ?, error = ?, updatedAt = ?
           WHERE id = ?`
        ).run(
          status,
          prediction.id || null,
          JSON.stringify(prediction.outputs),
          status === "failed" ? "Wavespeed provider rejected the request. Check images and prompt." : null,
          now(),
          generation.id
        );
      }
    } catch (error) {
      db.prepare("UPDATE wavespeed_generations SET status = ?, error = ?, updatedAt = ? WHERE id = ?").run(
        "failed",
        error instanceof Error ? error.message : "Wavespeed generation failed.",
        now(),
        generation.id
      );
    }

    return NextResponse.json(getGeneration(generation.id, user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wavespeed generation failed." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const id = String(body.id || "");
    const apiKey = String(body.apiKey || "");

    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const generation = getGeneration(id, user.id);
    if (!generation) {
      return NextResponse.json({ error: "Generation not found." }, { status: 404 });
    }

    if (generation.status === "completed" || generation.status === "failed") {
      return NextResponse.json(generation);
    }

    if (!apiKey) {
      return NextResponse.json({ error: "Wavespeed API key is required to check pending generation." }, { status: 400 });
    }

    if (!generation.predictionId || !generation.endpoint) {
      const timestamp = now();
      db.prepare("UPDATE wavespeed_generations SET status = ?, error = ?, updatedAt = ? WHERE id = ?").run(
        "failed",
        "Pending generation has no Wavespeed prediction id.",
        timestamp,
        id
      );
      return NextResponse.json(getGeneration(id, user.id));
    }

    const result = await checkWavespeedPrediction({
      apiKey,
      endpoint: generation.endpoint,
      predictionId: generation.predictionId
    });
    const status = normalizeStatus(result.status, result.outputs.length > 0);
    const timestamp = now();

    db.prepare(
      `UPDATE wavespeed_generations
       SET status = ?, resultImages = ?, error = ?, updatedAt = ?
       WHERE id = ?`
    ).run(
      status,
      result.outputs.length > 0 ? JSON.stringify(result.outputs) : generation.resultImages,
      status === "failed" ? result.error || "Wavespeed provider rejected the request." : null,
      timestamp,
      id
    );

    return NextResponse.json(getGeneration(id, user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wavespeed status check failed." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  db.prepare("DELETE FROM wavespeed_generations WHERE id = ? AND userId = ?").run(id, user.id);
  return NextResponse.json({ ok: true });
}

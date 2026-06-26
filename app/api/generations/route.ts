import { NextResponse } from "next/server";
import { createId, db, now, type GenerationRecord } from "@/app/lib/db";
import {
  generateGeminiImage,
  generateGeminiVideo,
  type GeminiSourceImage
} from "@/app/lib/gemini";
import { getCurrentUser } from "@/app/lib/auth";

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(value: string, maxLineLength = 42) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (nextLine.length > maxLineLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  });

  if (line) lines.push(line);
  return lines.slice(0, 5);
}

function createMockImage(prompt: string, aspectRatio: string, resolution: string) {
  const lines = wrapText(prompt).map((line, index) => {
    const y = 430 + index * 34;
    return `<text x="70" y="${y}" font-size="24" fill="#111">${escapeSvgText(line)}</text>`;
  });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fff6fa"/>
          <stop offset="0.5" stop-color="#ffd9e9"/>
          <stop offset="1" stop-color="#ffffff"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="35%" r="55%">
          <stop offset="0" stop-color="#ff5d9e" stop-opacity="0.5"/>
          <stop offset="1" stop-color="#ff5d9e" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <rect width="1024" height="1024" fill="url(#glow)"/>
      <circle cx="750" cy="220" r="140" fill="#111" opacity="0.08"/>
      <circle cx="250" cy="760" r="190" fill="#ec0071" opacity="0.12"/>
      <rect x="56" y="56" width="912" height="912" rx="44" fill="rgba(255,255,255,0.58)" stroke="#111" stroke-opacity="0.16"/>
      <text x="70" y="128" font-size="34" font-weight="800" fill="#ec0071">Demo generation</text>
      <text x="70" y="178" font-size="22" fill="#111" opacity="0.72">No Google request was sent</text>
      <text x="70" y="244" font-size="88" font-weight="900" fill="#111">AI OFM</text>
      <text x="70" y="320" font-size="28" fill="#111" opacity="0.78">${escapeSvgText(aspectRatio)} · ${escapeSvgText(resolution)}</text>
      ${lines.join("")}
      <text x="70" y="924" font-size="18" fill="#111" opacity="0.46">Use Demo mode to test UI, DB, history, favorites, delete, search.</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function GET(request: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");
  const search = searchParams.get("search") || "";
  const favorite = searchParams.get("favorite") === "true";
  const mediaType = searchParams.get("mediaType");

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required." }, { status: 400 });
  }

  const ownedProfile = db.prepare("SELECT id FROM profiles WHERE id = ? AND userId = ?").get(profileId, user.id);
  if (!ownedProfile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const clauses = ["profileId = ?"];
  const values: Array<string | number> = [profileId];

  if (favorite) {
    clauses.push("favorite = 1");
  }

  if (mediaType === "image" || mediaType === "video") {
    clauses.push("mediaType = ?");
    values.push(mediaType);
  }

  if (search) {
    clauses.push("prompt LIKE ?");
    values.push(`%${search}%`);
  }

  const generations = db
    .prepare(`SELECT * FROM generations WHERE ${clauses.join(" AND ")} ORDER BY createdAt DESC`)
    .all(...values) as GenerationRecord[];

  return NextResponse.json(generations.map((item) => ({ ...item, favorite: Boolean(item.favorite) })));
}

export async function POST(request: Request) {
  try {
    const user = getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const profileId = String(body.profileId || "");
    const apiKey = String(body.apiKey || "");
    const mock = Boolean(body.mock);
    const prompt = String(body.prompt || "").trim();
    const mediaType = body.mediaType === "video" ? "video" : "image";
    const model = String(body.model || "gemini-2.5-flash-image");
    const aspectRatio = String(body.aspectRatio || "1:1");
    const resolution = String(body.resolution || "1K");
    const durationSeconds = String(body.durationSeconds || "8");
    const sourceImages = (body.sourceImages || []) as GeminiSourceImage[];

    if (!profileId || (!apiKey && !mock) || !prompt) {
      return NextResponse.json(
        { error: "profileId, apiKey and prompt are required." },
        { status: 400 }
      );
    }

    const ownedProfile = db.prepare("SELECT id FROM profiles WHERE id = ? AND userId = ?").get(profileId, user.id);
    if (!ownedProfile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const imageData =
      mock && mediaType === "video"
        ? (() => {
            throw new Error("Demo mode currently supports image generation only. Switch to Image to test history and database without a key.");
          })()
        : mock
          ? createMockImage(prompt, aspectRatio, resolution)
          : mediaType === "video"
        ? await generateGeminiVideo({
            apiKey,
            prompt,
            model,
            sourceImages,
            aspectRatio,
            durationSeconds,
            resolution
          })
        : await generateGeminiImage({
            apiKey,
            prompt: `${prompt}\n\nAspect ratio: ${aspectRatio}. Resolution target: ${resolution}.`,
            model,
            sourceImages
          });

    const timestamp = now();
    const generation = {
      id: createId(),
      profileId,
      mediaType,
      prompt,
      imageData,
      sourceImages: JSON.stringify(sourceImages),
      model,
      aspectRatio,
      resolution,
      favorite: false,
      createdAt: timestamp
    };

    db.prepare(
      `INSERT INTO generations
        (id, profileId, mediaType, prompt, imageData, sourceImages, model, aspectRatio, resolution, favorite, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generation.id,
      generation.profileId,
      generation.mediaType,
      generation.prompt,
      generation.imageData,
      generation.sourceImages,
      generation.model,
      generation.aspectRatio,
      generation.resolution,
      0,
      generation.createdAt
    );
    db.prepare("UPDATE profiles SET updatedAt = ? WHERE id = ?").run(timestamp, profileId);

    return NextResponse.json(generation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    const isQuotaError =
      message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit");

    return NextResponse.json(
      {
        error: isQuotaError
          ? "Google отклонил запрос из-за квоты проекта. Проверь billing/rate limits в Google AI Studio. Для картинок нужен доступ к gemini-2.5-flash-image или gemini-3-pro-image-preview."
          : message
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, favorite } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  db.prepare(
    `UPDATE generations SET favorite = ? WHERE id = ? AND profileId IN
     (SELECT id FROM profiles WHERE userId = ?)`
  ).run(favorite ? 1 : 0, id, user.id);
  const generation = db.prepare(
    `SELECT generations.* FROM generations JOIN profiles ON profiles.id = generations.profileId
     WHERE generations.id = ? AND profiles.userId = ?`
  ).get(id, user.id) as
    | GenerationRecord
    | undefined;

  if (!generation) {
    return NextResponse.json({ error: "Generation not found." }, { status: 404 });
  }

  return NextResponse.json({ ...generation, favorite: Boolean(generation.favorite) });
}

export async function DELETE(request: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  db.prepare(
    `DELETE FROM generations WHERE id = ? AND profileId IN
     (SELECT id FROM profiles WHERE userId = ?)`
  ).run(id, user.id);
  return NextResponse.json({ ok: true });
}

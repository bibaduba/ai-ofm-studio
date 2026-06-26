import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth";
import { createId, db, now } from "@/app/lib/db";

type Row = Record<string, unknown>;

function rows(value: unknown, limit = 5000): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === "object").slice(0, limit) : [];
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function uniqueProfileName(value: unknown) {
  const base = textValue(value, "Imported profile").trim().slice(0, 60) || "Imported profile";
  let candidate = base;
  let suffix = 2;
  while (db.prepare("SELECT id FROM profiles WHERE name = ?").get(candidate)) {
    candidate = `${base.slice(0, 52)} (${suffix++})`;
  }
  return candidate;
}

export async function POST(request: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = await request.json();
    if (payload?.version !== 1 || !payload?.data) {
      return NextResponse.json({ error: "Неподдерживаемый файл экспорта." }, { status: 400 });
    }

    const profiles = rows(payload.data.profiles, 200);
    const generations = rows(payload.data.generations);
    const models = rows(payload.data.wavespeedModels, 500);
    const wavespeedGenerations = rows(payload.data.wavespeedGenerations);
    const profileIds = new Map<string, string>();
    const modelIds = new Map<string, string>();
    const timestamp = now();

    db.exec("BEGIN IMMEDIATE;");
    try {
      for (const profile of profiles) {
        const oldId = textValue(profile.id);
        const id = createId();
        if (oldId) profileIds.set(oldId, id);
        db.prepare(
          "INSERT INTO profiles (id, userId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)"
        ).run(id, user.id, uniqueProfileName(profile.name), textValue(profile.createdAt, timestamp), textValue(profile.updatedAt, timestamp));
      }

      for (const generation of generations) {
        const profileId = profileIds.get(textValue(generation.profileId));
        if (!profileId || !textValue(generation.imageData)) continue;
        db.prepare(
          `INSERT INTO generations
            (id, profileId, mediaType, prompt, imageData, sourceImages, model, aspectRatio, resolution, favorite, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          createId(), profileId, textValue(generation.mediaType, "image"), textValue(generation.prompt),
          textValue(generation.imageData), generation.sourceImages == null ? null : textValue(generation.sourceImages),
          textValue(generation.model, "imported"), textValue(generation.aspectRatio, "1:1"),
          textValue(generation.resolution, "1K"), generation.favorite ? 1 : 0,
          textValue(generation.createdAt, timestamp)
        );
      }

      for (const model of models) {
        const oldId = textValue(model.id);
        const id = createId();
        if (oldId) modelIds.set(oldId, id);
        db.prepare(
          `INSERT INTO wavespeed_models
            (id, userId, name, faceReferences, bodyReferences, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id, user.id, textValue(model.name, "Imported model"), textValue(model.faceReferences, "[]"),
          textValue(model.bodyReferences, "[]"), textValue(model.createdAt, timestamp), textValue(model.updatedAt, timestamp)
        );
      }

      for (const generation of wavespeedGenerations) {
        const oldModelId = textValue(generation.wavespeedModelId);
        db.prepare(
          `INSERT INTO wavespeed_generations
            (id, userId, wavespeedModelId, mode, prompt, faceReferences, bodyReferences, sceneReference,
             resultImages, status, predictionId, endpoint, error, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          createId(), user.id, modelIds.get(oldModelId) || null, textValue(generation.mode, "model"),
          textValue(generation.prompt), generation.faceReferences == null ? null : textValue(generation.faceReferences),
          generation.bodyReferences == null ? null : textValue(generation.bodyReferences),
          generation.sceneReference == null ? null : textValue(generation.sceneReference),
          textValue(generation.resultImages, "[]"), textValue(generation.status, "completed"),
          generation.predictionId == null ? null : textValue(generation.predictionId),
          generation.endpoint == null ? null : textValue(generation.endpoint),
          generation.error == null ? null : textValue(generation.error),
          textValue(generation.createdAt, timestamp), textValue(generation.updatedAt, timestamp)
        );
      }

      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }

    return NextResponse.json({
      ok: true,
      imported: { profiles: profiles.length, generations: generations.length, models: models.length, wavespeedGenerations: wavespeedGenerations.length }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось импортировать данные." },
      { status: 500 }
    );
  }
}

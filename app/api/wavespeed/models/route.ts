import { NextResponse } from "next/server";
import { createId, db, now, type WavespeedModelRecord } from "@/app/lib/db";
import { getCurrentUser } from "@/app/lib/auth";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const models = db
    .prepare("SELECT * FROM wavespeed_models WHERE userId = ? ORDER BY updatedAt DESC")
    .all(user.id) as WavespeedModelRecord[];

  return NextResponse.json(models);
}

export async function POST(request: Request) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const name = String(body.name || "").trim();
  const faceReferences = Array.isArray(body.faceReferences) ? body.faceReferences : [];
  const bodyReferences = Array.isArray(body.bodyReferences) ? body.bodyReferences : [];

  if (!name || faceReferences.length === 0 || bodyReferences.length === 0) {
    return NextResponse.json(
      { error: "Name, face references and body references are required." },
      { status: 400 }
    );
  }

  const timestamp = now();
  const model = {
    id: createId(),
    userId: user.id,
    name,
    faceReferences: JSON.stringify(faceReferences.slice(0, 2)),
    bodyReferences: JSON.stringify(bodyReferences.slice(0, 2)),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  db.prepare(
    `INSERT INTO wavespeed_models
      (id, userId, name, faceReferences, bodyReferences, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    model.id,
    model.userId,
    model.name,
    model.faceReferences,
    model.bodyReferences,
    model.createdAt,
    model.updatedAt
  );

  return NextResponse.json(model);
}
